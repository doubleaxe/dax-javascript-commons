import { defineConfig } from 'eslint/config';
import pluginVue from 'eslint-plugin-vue';
import parserVue from 'vue-eslint-parser';

import es from './es.js';
import type { EslintConfig, EslintPlugin, EslintRules, EslintSharedConfigs } from './types.js';

const extensionRules: EslintRules = {
    'vue/camelcase': [
        'error',
        {
            ignoreDestructuring: true,
            ignoreGlobals: true,
            ignoreImports: true,
        },
    ],
    'vue/eqeqeq': ['error'],
    'vue/no-loss-of-precision': ['error'],
    'vue/no-sparse-arrays': ['error'],
    'vue/no-useless-concat': ['error'],
    'vue/object-shorthand': [
        'error',
        'always',
        {
            avoidQuotes: true,
        },
    ],
    'vue/prefer-template': ['error'],
};

const rules: EslintRules = {
    'vue/component-name-in-template-casing': [
        'error',
        'PascalCase',
        {
            registeredComponentsOnly: false,
        },
    ],
    'vue/custom-event-name-casing': ['error'],
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

const vueEsNextBase: EslintConfig = {
    name: 'doubleaxe/vue3/esNext',
    plugins: { vue: pluginVue },
    rules: { ...rules, ...extensionRules },
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

const vueEsNext = defineConfig(
    es.utils.extendFiles([...es.configs.esNext, ...vueEsNextRoot], es.patterns.vueFilter),
    es.configs.browser
);
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
    plugins: {
        ...es.plugins,
        vue: pluginVue as EslintPlugin,
    },
} satisfies EslintSharedConfigs;
