#!/usr/bin/env node

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function signPackage(appOutDir) {
    if (process.env.STRICT_VMP_SIGNING === 'true' && (!process.env.EVS_USERNAME || !process.env.EVS_PASSWORD)) {
        console.error('EVS_USERNAME and EVS_PASSWORD are required when STRICT_VMP_SIGNING=true');
        process.exit(1);
    }

    // Resolve the full path to the packaged app directory
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
        // Sign the package using EVS
        // For Windows: sign after code-signing (if any)
        // For macOS: sign before code-signing
        const result = execFileSync('python', ['-m', 'castlabs_evs.vmp', 'sign-pkg', packageDir], {
            encoding: 'utf8',
            stdio: 'pipe',
        });

        console.log('EVS signing output:', result);
        console.log('VMP signing completed successfully');
    } catch (error) {
        console.error('EVS signing failed:');
        if (error.stdout) console.error('stdout:', error.stdout);
        if (error.stderr) console.error('stderr:', error.stderr);
        console.error('exit status:', error.status);

        // Set STRICT_VMP_SIGNING=true environment variable to enforce
        if (process.env.STRICT_VMP_SIGNING === 'true') {
            process.exit(1);
        }
    }
}

// Export function for electron-builder afterSign hook
// electron-builder passes context object with: appOutDir, packager
module.exports = function (context) {
    const { appOutDir } = context;
    signPackage(appOutDir);
};

// If called directly with a path argument (for manual signing)
if (require.main === module) {
    const appOutDir = process.argv[2];
    if (!appOutDir) {
        console.error('Usage: node scripts/sign-vmp.js <path-to-packaged-app>');
        process.exit(1);
    }
    signPackage(appOutDir);
}
