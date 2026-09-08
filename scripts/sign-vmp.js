#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Runs the castlabs EVS module under the first interpreter that exists.
 *
 * This used to hard-code `python`, which macOS 12.3+ does not ship at all -- Apple
 * removed it and never added an alias, only `python3`. On every modern Mac the spawn
 * failed with ENOENT before castlabs was consulted, the failure was caught, and the
 * build shipped unsigned. Set EVS_PYTHON to force a specific interpreter.
 */
function runEvs(args) {
    const candidates = process.env.EVS_PYTHON ? [process.env.EVS_PYTHON] : ['python3', 'python'];

    let last;
    for (const interpreter of candidates) {
        last = spawnSync(interpreter, args, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        // ENOENT means this interpreter is not installed; anything else is a real
        // result from an interpreter that exists, so stop here
        if (!last.error || last.error.code !== 'ENOENT') {
            last.interpreter = interpreter;
            return last;
        }
    }

    last.error = new Error(
        `No Python interpreter found (tried: ${candidates.join(', ')}). ` +
            'Install Python 3, or set EVS_PYTHON to the interpreter that has castlabs-evs installed.',
    );
    return last;
}

function signPackage(appOutDir) {
    if (process.env.STRICT_VMP_SIGNING === 'true' && (!process.env.EVS_USERNAME || !process.env.EVS_PASSWORD)) {
        console.error('EVS_USERNAME and EVS_PASSWORD are required when STRICT_VMP_SIGNING=true');
        process.exit(1);
    }

    // resolve full path to packaged app dir
    const packageDir = path.resolve(appOutDir);

    if (!fs.existsSync(packageDir)) {
        console.error(`Package directory not found: ${packageDir}`);
        if (process.env.STRICT_VMP_SIGNING === 'true') {
            process.exit(1);
        }
        return;
    }

    console.log(`VMP Signing Application at ${packageDir}`);

    try {
        // sign package using EVS via safe binary spawning
        // for win: sign after code signing (if any)
        // for mac: sign before code signing
        const subprocess = runEvs(['-m', 'castlabs_evs.vmp', 'sign-pkg', packageDir]);

        // check if subprocess threw internal operational system error
        if (subprocess.error) {
            throw subprocess.error;
        }

        // if python returned a non-zero exit code, manually throw it to trigger catch safety block
        if (subprocess.status !== 0) {
            const customError = new Error(`Process exited with code ${subprocess.status}`);
            customError.stdout = subprocess.stdout;
            customError.stderr = subprocess.stderr;
            customError.status = subprocess.status;
            throw customError;
        }

        console.log(`EVS signing output (${subprocess.interpreter}):`, subprocess.stdout);
        console.log('VMP signing completed successfully');
    } catch (error) {
        // this catch covers every failure mode, not just a missing module: bad or absent
        // EVS credentials, an expired account, and network errors all land here
        console.warn('\n' + '='.repeat(72));
        console.warn('WARNING: VMP signing did not complete. The build is NOT signed.');
        console.warn('');
        console.warn('DRM-protected audio will NOT play in this build. On SoundCloud');
        console.warn('that means every SoundCloud Go and Go+ track fails silently --');
        console.warn('the player skips or stalls with no visible error. Free tracks are');
        console.warn('unaffected, which is what makes this easy to miss.');
        console.warn('');
        console.warn('Widevine requires a VMP signature on macOS and Windows. To sign:');
        console.warn('  pip install --upgrade castlabs-evs');
        console.warn('  python -m castlabs_evs.account signup      # once, free');
        console.warn('  EVS_USERNAME=... EVS_PASSWORD=... npm run build-mac');
        console.warn('');
        console.warn('Set STRICT_VMP_SIGNING=true to fail the build instead of warning.');
        console.warn('='.repeat(72) + '\n');

        if (error.stdout) console.error('stdout:', error.stdout);
        if (error.stderr) console.error('stderr:', error.stderr);

        // ENFORCE: only crash build if strictly requested by env vars
        if (process.env.STRICT_VMP_SIGNING === 'true') {
            console.error('STRICT_VMP_SIGNING is enabled. Aborting build.');
            process.exit(1);
        }

        // FALLBACK: if strict mode off, log it and exit w 0
        console.log('Continuing build without VMP signing...\n');
        return;
    }
}

// Export function for electron-builder afterSign hook
// electron-builder passes context object with: appOutDir, packager
module.exports = function (context) {
    const { appOutDir } = context;

    // vmp signing isn't a thing on linux, widevine works without it there
    if (context.electronPlatformName === 'linux') {
        console.log('linux build, skipping VMP signing');
        return;
    }

    signPackage(appOutDir);
};

// if called directly w a path argument (for manual signing)
if (require.main === module) {
    const appOutDir = process.argv[2];
    if (!appOutDir) {
        console.error('Usage: node scripts/sign-vmp.js <path-to-packaged-app>');
        process.exit(1);
    }
    signPackage(appOutDir);
}
