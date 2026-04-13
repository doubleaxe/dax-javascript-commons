import { defineConfig } from 'eslint/config';
import reactPlugin from 'eslint-plugin-react';

import reactEs from './react-es.js';
import ts from './ts.js';
import type { EslintConfig, EslintRules, EslintSharedConfigs } from './types.js';

const rules: EslintRules = {
    'react/boolean-prop-naming': 'error',
};

/** @type {EslintConfig} */
const reactTsBase: EslintConfig = {
    name: 'doubleaxe/react/ts',
    plugins: { react: reactPlugin },
    rules,
};

const reactTsRoot = defineConfig(reactEs.configs.reactEsNextRoot, reactTsBase);

const reactTs = defineConfig(
    ts.utils.extendFiles(reactEs.configs.reactEsNext, ts.patterns.tsxFilter),
    ts.utils.extendFiles(ts.configs.tsRoot, ts.patterns.tsFilter),
    ts.utils.extendFiles([reactTsBase], ts.patterns.tsxFilter)
);

export default {
    ...ts,
    baseConfigs: {
        ...reactEs.baseConfigs,
        ...ts.baseConfigs,
        reactTsBase,
    },
    configs: {
        ...reactEs.configs,
        ...ts.configs,
        reactTsRoot,
        reactTs,
    },
    plugins: {
        ...ts.plugins,
        ...reactEs.plugins,
    },
} satisfies EslintSharedConfigs;
