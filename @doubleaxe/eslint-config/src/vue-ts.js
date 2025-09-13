import { defineConfig } from 'eslint/config';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import parserVue from 'vue-eslint-parser';

import ts from './ts.js';
import vueEs from './vue-es.js';

/**
 * @typedef EslintConfig
 * @type {import("eslint").Linter.Config}
 */
/**
 * @typedef EslintRules
 * @type {import("eslint").Linter.RulesRecord}
 */

/** @type {EslintRules} */
export const rules = {
    'vue/define-emits-declaration': ['error'],
    'vue/define-props-declaration': ['error'],
    'vue/require-typed-ref': ['error'],
};

/** @type {EslintConfig} */
const vueTsBase = {
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
};
