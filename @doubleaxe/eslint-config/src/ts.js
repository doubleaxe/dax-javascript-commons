import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

import es from './es.js';

/**
 * @typedef EslintConfig
 * @type {import("eslint").Linter.Config}
 */
/**
 * @typedef EslintRules
 * @type {import("eslint").Linter.RulesRecord}
 */

// typescript recommended are much better
/** @type {EslintRules} */
const rules = {
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    '@typescript-eslint/consistent-type-imports': ['error'],
    '@typescript-eslint/consistent-type-exports': ['error'],
    '@typescript-eslint/default-param-last': ['error'],
    '@typescript-eslint/method-signature-style': ['error'],
    '@typescript-eslint/naming-convention': [
        'error',
        {
            selector: 'default',
            format: ['camelCase', 'PascalCase'],
            leadingUnderscore: 'allowSingleOrDouble',
            trailingUnderscore: 'allowSingleOrDouble',
        },
        {
            selector: 'variable',
            format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
            leadingUnderscore: 'allowSingleOrDouble',
            trailingUnderscore: 'allowSingleOrDouble',
        },
        {
            selector: 'import',
            format: null,
        },
        {
            selector: 'variable',
            modifiers: ['destructured'],
            format: null,
        },
        {
            selector: 'parameter',
            modifiers: ['destructured'],
            format: null,
        },
        {
            selector: 'typeLike',
            format: ['PascalCase'],
            leadingUnderscore: 'allowSingleOrDouble',
            trailingUnderscore: 'allowSingleOrDouble',
        },
    ],
    '@typescript-eslint/no-empty-function': ['off'],
    // we have verbatimModuleSyntax
    '@typescript-eslint/no-import-type-side-effects': ['error'],
    '@typescript-eslint/no-invalid-void-type': ['error'],
    '@typescript-eslint/no-loop-func': ['error'],
    '@typescript-eslint/no-misused-spread': ['error'],
    '@typescript-eslint/no-non-null-asserted-nullish-coalescing': ['error'],
    '@typescript-eslint/no-redundant-type-constituents': ['off'],
    '@typescript-eslint/no-shadow': [
        'error',
        {
            builtinGlobals: true,
        },
    ],
    '@typescript-eslint/no-unused-expressions': [
        'error',
        {
            allowShortCircuit: true,
            allowTaggedTemplates: false,
            allowTernary: true,
            enforceForJSX: false,
        },
    ],
    '@typescript-eslint/no-unused-vars': [
        'error',
        {
            args: 'after-used',
            argsIgnorePattern: '^_\\d*$',
            caughtErrors: 'none',
            destructuredArrayIgnorePattern: '^_\\d*$',
            ignoreRestSiblings: true,
            reportUsedIgnorePattern: true,
            vars: 'all',
        },
    ],
    '@typescript-eslint/no-use-before-define': [
        'error',
        {
            classes: false,
            functions: false,
            typedefs: false,
        },
    ],
    '@typescript-eslint/no-useless-constructor': ['error'],
    '@typescript-eslint/prefer-reduce-type-parameter': ['error'],
    '@typescript-eslint/unified-signatures': ['error'],

    'camelcase': ['off'],
    'default-param-last': ['off'],
    'no-loop-func': ['off'],
    'no-shadow': ['off'],
    'no-throw-literal': ['off'],
    'no-unused-expressions': ['off'],
    'no-unused-vars': ['off'],
    'no-use-before-define': ['off'],
    'no-useless-constructor': ['off'],
};

/** @type {EslintConfig} */
const tsBase = {
    name: 'doubleaxe/ts',
    rules,
    plugins: {
        '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
            project: true,
            //see https://github.com/vuejs/eslint-plugin-vue/issues/2428
            //see https://github.com/typescript-eslint/typescript-eslint/issues/6778
            extraFileExtensions: ['.vue'],
            sourceType: 'module',
            ecmaFeatures: {
                jsx: true,
            },
        },
    },
    settings: {},
};

const tsRoot = defineConfig(
    tseslint.configs.recommendedTypeChecked,
    // without duplicate base configs
    tseslint.configs.stylisticTypeChecked[tseslint.configs.stylisticTypeChecked.length - 1],
    tsBase
);

const ts = es.utils.extendFiles(defineConfig(es.configs.esNext, tsRoot), es.patterns.tsFilter);

const tsTools = es.utils.extendFiles(defineConfig(es.configs.esNext, tsRoot, es.configs.node), es.patterns.toolsTs);

export default {
    ...es,
    baseConfigs: {
        ...es.baseConfigs,
        tsBase,
    },
    configs: {
        ...es.configs,
        tsRoot,
        ts,
        tsTools,
    },
    plugins: {
        ...es.plugins,
        '@typescript-eslint': es.utils.inferPlugin(tseslint.plugin),
    },
};
