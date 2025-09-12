import { defineConfig } from 'eslint/config';
import nodePlugin from 'eslint-plugin-n';
import pluginSecurity from 'eslint-plugin-security';
import globals from 'globals';

/**
 * @typedef EslintConfig
 * @type {import("eslint").Linter.Config}
 */
/**
 * @typedef EslintRules
 * @type {import("eslint").Linter.RulesRecord}
 */

const node = defineConfig(pluginSecurity.configs.recommended, {
    name: 'doubleaxe/node',
    rules: {
        // we don't use recommended here, because it overlap eslint-plugin-import
        // only rules that don't require resolution (resolution is slow, complex to setup and buggy)
        'n/file-extension-in-import': ['error'],
        'n/no-deprecated-api': ['error'],
        'n/no-unsupported-features/es-builtins': ['error'],
        'n/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }],
        'n/no-unsupported-features/node-builtins': ['error'],
        'n/prefer-node-protocol': ['error'],
    },
    plugins: {
        n: nodePlugin,
    },
    languageOptions: {
        globals: {
            ...globals.nodeBuiltin,
        },
    },
    settings: {},
});

export default {
    baseConfigs: {},
    configs: {
        node,
    },
};
