import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

import type { EslintPlugin, EslintSimpleSharedConfig } from './types.js';

const browser = defineConfig({
    name: 'doubleaxe/browser',
    rules: {
        'import/no-nodejs-modules': ['error'],
    },
    plugins: {
        import: importPlugin,
    },
    languageOptions: {
        globals: {
            ...globals.browser,
        },
    },
    settings: {},
});

export default {
    baseConfigs: {},
    configs: {
        browser,
    },
    plugins: {
        import: importPlugin as EslintPlugin,
    },
} satisfies EslintSimpleSharedConfig;
