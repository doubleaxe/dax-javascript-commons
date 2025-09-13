import { defineConfig } from 'eslint/config';
import pluginVue from 'eslint-plugin-vue';
import parserVue from 'vue-eslint-parser';

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
export const rules = {
    'vue/component-name-in-template-casing': [
        'error',
        'PascalCase',
        {
            registeredComponentsOnly: false,
        },
    ],
    'vue/custom-event-name-casing': ['error', 'kebab-case'],
    'vue/define-macros-order': ['error'],
    // prettier conflict
    'vue/html-end-tags': ['off'],
    'vue/no-duplicate-attr-inheritance': ['error'],
    'vue/no-import-compiler-macros': ['error'],
    'vue/no-undef-components': ['error'],
    'vue/no-undef-properties': ['error'],
    'vue/no-unused-emit-declarations': ['error'],
    'vue/no-unused-properties': ['error'],
    'vue/no-unused-refs': ['error'],
    'vue/no-use-v-else-with-v-for': ['error'],
    'vue/no-useless-mustaches': ['error'],
    'vue/no-useless-v-bind': ['error'],
    'vue/prefer-define-options': ['error'],
    'vue/prefer-true-attribute-shorthand': ['error'],
    'vue/prefer-use-template-ref': ['error'],
    'vue/require-macro-variable-name': ['error'],
    'vue/slot-name-casing': ['error'],
};

/** @type {EslintConfig} */
const vueEsNextBase = {
    name: 'doubleaxe/vue3/esNext',
    plugins: { vue: pluginVue },
    rules,
    languageOptions: {
        parser: parserVue,
    },
    settings: {},
};

const vueEsNextRoot = defineConfig(
    pluginVue.configs['flat/recommended'],
    {
        name: 'vue/no-layout-rules',
        rules: pluginVue.configs['no-layout-rules'].rules,
    },
    vueEsNextBase
);

const vueEsNext = es.utils.extendFiles(defineConfig(es.configs.esNext, vueEsNextRoot), es.patterns.vueFilter);

export default {
    ...es,
    baseConfigs: {
        ...es.baseConfigs,
        vueEsNextBase,
    },
    configs: {
        ...es.configs,
        vueEsNextRoot,
        vueEsNext,
    },
};
