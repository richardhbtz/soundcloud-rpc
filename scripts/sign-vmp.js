#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

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
        const subprocess = spawnSync('python', ['-m', 'castlabs_evs.vmp', 'sign-pkg', packageDir], {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'], // explicitly separate streams safely
        });

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

        console.log('EVS signing output:', subprocess.stdout);
        console.log('VMP signing completed successfully');
    } catch (error) {
        console.warn('\n⚠️  EVS signing module not found locally. Skipping VMP signing.');
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
