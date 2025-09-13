import { defineConfig } from 'eslint/config';
import reactPlugin from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

import es from './es.js';

/**
 * @typedef EslintConfig
 * @type {import("eslint").Linter.Config}
 */
/**
 * @typedef EslintRules
 * @type {import("eslint").Linter.RulesRecord}
 */

/** @type {EslintRules} */
const rules = {
    'react-refresh/only-export-components': [
        'warn',
        {
            allowConstantExport: true,
        },
    ],
    'react/button-has-type': ['error'],
    'react/forward-ref-uses-ref': ['error'],
    'react/function-component-definition': ['error'],
    'react/hook-use-state': ['error'],
    'react/jsx-boolean-value': ['error'],
    'react/jsx-filename-extension': [
        'error',
        {
            allow: 'as-needed',
            extensions: ['.jsx', '.mjsx', '.tsx', '.mtsx'],
        },
    ],
    'react/jsx-fragments': ['error'],
    'react/jsx-handler-names': ['error'],
    'react/jsx-no-constructed-context-values': ['error'],
    'react/jsx-no-script-url': ['error'],
    'react/jsx-no-useless-fragment': ['error'],
    'react/jsx-pascal-case': ['error'],
    'react/jsx-sort-props': ['error'],
    'react/no-access-state-in-setstate': ['error'],
    'react/no-danger': ['error'],
    'react/no-namespace': ['error'],
    'react/no-object-type-as-default-prop': ['error'],
    'react/no-redundant-should-component-update': ['error'],
    'react/no-this-in-sfc': ['error'],
    'react/style-prop-object': ['error'],
};

/** @type {EslintConfig} */
const reactEsNextBase = {
    name: 'doubleaxe/react/esNext',
    plugins: { 'react': reactPlugin, 'react-refresh': reactRefresh },
    rules,
    settings: {
        react: {
            version: 'detect',
        },
    },
};

const reactEsNextRoot = defineConfig(
    {
        ...reactPlugin.configs.flat.recommended,
        name: 'react/recommended',
    },
    {
        ...reactPlugin.configs.flat['jsx-runtime'],
        name: 'react/jsx-runtime',
    },
    hooks.configs['recommended-latest'],
    es.configs.browser,
    reactEsNextBase
);

const reactEsNext = defineConfig(es.configs.esNext, es.utils.extendFiles(reactEsNextRoot, ['**/*.jsx']));

export default {
    ...es,
    baseConfigs: {
        ...es.baseConfigs,
        reactEsNextBase,
    },
    configs: {
        ...es.configs,
        reactEsNextRoot,
        reactEsNext,
    },
};
