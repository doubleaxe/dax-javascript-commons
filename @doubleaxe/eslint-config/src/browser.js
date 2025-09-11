import globals from 'globals';
import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';

/**
 * @typedef EslintConfig
 * @type {import("eslint").Linter.Config}
 */
/**
 * @typedef EslintRules
 * @type {import("eslint").Linter.RulesRecord}
 */

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
};
