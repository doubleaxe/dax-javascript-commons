import { defineConfig } from 'eslint/config';
import reactPlugin from 'eslint-plugin-react';

import reactEs from './react-es.js';
import ts from './ts.js';

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
    'react/boolean-prop-naming': 'error',
};

/** @type {EslintConfig} */
const reactTsBase = {
    name: 'doubleaxe/react/ts',
    plugins: { react: reactPlugin },
    rules,
};

const reactTsRoot = defineConfig(reactEs.configs.reactEsNextRoot, reactTsBase);

const reactTs = defineConfig(
    ts.utils.extendFiles(reactEs.configs.reactEsNext, ['**/*.tsx']),
    ts.utils.extendFiles(ts.configs.tsRoot, ts.patterns.tsFilter),
    ts.utils.extendFiles([reactTsBase], ['**/*.tsx'])
);

export default {
    ...ts,
    baseConfigs: {
        ...reactEs.baseConfigs,
        ...ts.baseConfigs,
        reactTsBase,
    },
    configs: {
        ...reactEs.baseConfigs,
        ...ts.configs,
        reactTsRoot,
        reactTs,
    },
    plugins: {
        ...ts.plugins,
        ...reactEs.plugins,
    },
};
