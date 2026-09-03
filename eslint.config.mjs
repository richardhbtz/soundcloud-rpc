import { defineConfig } from 'eslint/config';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default defineConfig([
    {
        extends: compat.extends(
            'eslint:recommended',
            'plugin:@typescript-eslint/eslint-recommended',
            'plugin:@typescript-eslint/recommended',
        ),

        plugins: {
            '@typescript-eslint': typescriptEslint,
        },

        languageOptions: {
            parser: tsParser,
        },
    },
    {
        // Renderer-side scripts. These run in a BrowserView, not in Node, so they need
        // browser globals -- and they are plain JavaScript, so the TypeScript parser and
        // its type-aware rules do not apply.
        files: ['src/header/**/*.js', 'src/settings/*.js', 'src/notification/*.js', 'src/confirm/*.js'],
        languageOptions: {
            parser: undefined,
            sourceType: 'script',
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
]);
