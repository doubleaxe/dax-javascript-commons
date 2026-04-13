import { defineConfig } from 'eslint/config';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import parserVue from 'vue-eslint-parser';

import ts from './ts.js';
import type { EslintConfig, EslintRules, EslintSharedConfigs } from './types.js';
import vueEs from './vue-es.js';

const rules: EslintRules = {
    'vue/camelcase': ['off'],
    'vue/define-emits-declaration': ['error'],
    'vue/define-props-declaration': ['error'],
    'vue/require-typed-ref': ['error'],
};

const vueTsBase: EslintConfig = {
    name: 'doubleaxe/vue3/ts',
    plugins: { vue: pluginVue },
    rules,
    languageOptions: {
        parser: parserVue,
        parserOptions: {
            parser: tseslint.parser,
        },
    },
    settings: {},
};

const vueTsRoot = defineConfig(vueEs.configs.vueEsNextRoot, vueTsBase);

const vueTs = ts.utils.extendFiles(defineConfig(ts.configs.ts, vueTsRoot), ts.patterns.vueFilter);

export default {
    ...ts,
    baseConfigs: {
        ...ts.baseConfigs,
        vueTsBase,
    },
    configs: {
        ...ts.configs,
        vueTsRoot,
        vueTs,
    },
    plugins: {
        ...ts.plugins,
        ...vueEs.plugins,
    },
} satisfies EslintSharedConfigs;
