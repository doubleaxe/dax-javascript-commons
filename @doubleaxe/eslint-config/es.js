import globals from 'globals';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';

import root from './root.js';

/**
 * @typedef EslintConfig
 * @type {import("eslint").Linter.Config}
 */
/**
 * @typedef EslintRules
 * @type {import("eslint").Linter.RulesRecord}
 */

/** @type {EslintRules} */
const esNextRulesBase = {
    'array-callback-return': [
        'error',
        {
            allowImplicit: true,
            checkForEach: false,
            allowVoid: false,
        },
    ],
    'block-scoped-var': ['error'],
    'camelcase': [
        'error',
        {
            properties: 'never',
            ignoreDestructuring: true,
            ignoreImports: true,
            ignoreGlobals: true,
        },
    ],
    'consistent-return': ['error'],
    'default-case-last': ['error'],
    'default-param-last': ['error'],
    'dot-notation': [
        'error',
        {
            allowKeywords: true,
            allowPattern: '',
        },
    ],
    'grouped-accessor-pairs': ['error'],
    'no-alert': ['warn'],
    'no-array-constructor': ['error'],
    'no-caller': ['error'],
    'no-constructor-return': ['error'],
    'no-else-return': [
        'error',
        {
            allowElseIf: true,
        },
    ],
    'no-empty-function': [
        'error',
        {
            allow: ['arrowFunctions', 'functions', 'methods'],
        },
    ],
    'no-eq-null': ['error'],
    'no-eval': ['error'],
    'no-extend-native': ['error'],
    'no-extra-bind': ['error'],
    'no-extra-label': ['error'],
    'no-implied-eval': ['error'],
    'no-iterator': ['error'],
    'no-label-var': ['error'],
    'no-labels': [
        'error',
        {
            allowLoop: false,
            allowSwitch: false,
        },
    ],
    'no-lone-blocks': ['error'],
    'no-lonely-if': ['error'],
    'no-loop-func': ['error'],
    'no-multi-assign': ['error'],
    'no-multi-str': ['error'],
    'no-nested-ternary': ['error'],
    'no-new': ['error'],
    'no-new-func': ['error'],
    'no-new-wrappers': ['error'],
    'no-object-constructor': ['error'],
    'no-octal-escape': ['error'],
    'no-promise-executor-return': ['error'],
    'no-proto': ['error'],
    'no-restricted-globals': [
        'error',
        {
            name: 'isFinite',
            message: 'Use Number.isFinite instead https://github.com/airbnb/javascript#standard-library--isfinite',
        },
        {
            name: 'isNaN',
            message: 'Use Number.isNaN instead https://github.com/airbnb/javascript#standard-library--isnan',
        },
    ],
    'no-return-assign': ['error', 'always'],
    'no-script-url': ['error'],
    'no-self-compare': ['error'],
    'no-sequences': ['error'],
    'no-shadow': ['error'],
    'no-template-curly-in-string': ['error'],
    'no-throw-literal': ['error'],
    'no-undef-init': ['error'],
    'no-unneeded-ternary': [
        'error',
        {
            defaultAssignment: false,
        },
    ],
    'no-unreachable-loop': [
        'error',
        {
            ignore: [],
        },
    ],
    'no-unused-expressions': [
        'error',
        {
            allowShortCircuit: true,
            allowTernary: true,
            allowTaggedTemplates: false,
            enforceForJSX: false,
        },
    ],
    'no-unused-vars': [
        'error',
        {
            vars: 'all',
            args: 'after-used',
            argsIgnorePattern: '^_\\d*$',
            destructuredArrayIgnorePattern: '^_\\d*$',
            caughtErrors: 'none',
            ignoreRestSiblings: true,
            reportUsedIgnorePattern: true,
        },
    ],
    'no-use-before-define': [
        'error',
        {
            functions: false,
            classes: false,
        },
    ],
    'no-useless-concat': ['error'],
    'no-useless-return': ['error'],
    'no-void': ['error'],
    'object-shorthand': [
        'error',
        'always',
        {
            avoidQuotes: true,
        },
    ],
    'one-var': ['error', 'never'],
    'operator-assignment': ['error', 'always'],
    'prefer-const': [
        'error',
        {
            destructuring: 'all',
            ignoreReadBeforeAssign: true,
        },
    ],
    'prefer-promise-reject-errors': [
        'error',
        {
            allowEmptyReject: true,
        },
    ],
    'prefer-regex-literals': [
        'error',
        {
            disallowRedundantWrapping: true,
        },
    ],
    'radix': ['error'],
    'require-await': 'error',
    'unicode-bom': ['error', 'never'],
    'yoda': ['error'],

    'no-restricted-properties': [
        'error',
        {
            object: 'arguments',
            property: 'callee',
            message: 'arguments.callee is deprecated',
        },
        {
            property: '__defineGetter__',
            message: 'Please use Object.defineProperty instead.',
        },
        {
            property: '__defineSetter__',
            message: 'Please use Object.defineProperty instead.',
        },
    ],
    'no-var': ['error'],
    'prefer-numeric-literals': ['error'],
    'prefer-object-spread': ['error'],

    'arrow-body-style': [
        'error',
        'as-needed',
        {
            requireReturnForObjectLiteral: false,
        },
    ],
    'no-restricted-exports': [
        'error',
        {
            restrictedNamedExports: ['default', 'then'],
        },
    ],
    'no-useless-computed-key': ['error'],
    'no-useless-constructor': ['error'],
    'no-useless-rename': [
        'error',
        {
            ignoreDestructuring: false,
            ignoreImport: false,
            ignoreExport: false,
        },
    ],
    'prefer-arrow-callback': [
        'error',
        {
            allowNamedFunctions: false,
            allowUnboundThis: true,
        },
    ],
    'prefer-exponentiation-operator': ['error'],
    'prefer-rest-params': ['error'],
    'prefer-spread': ['error'],
    'prefer-template': ['error'],
    'symbol-description': ['error'],

    'eqeqeq': ['error'],
    'no-duplicate-imports': ['error', { includeExports: true, allowSeparateTypeImports: true }],
    'no-unassigned-vars': ['error'],
    'no-unmodified-loop-condition': ['error'],
    'no-useless-assignment': ['error'],
};

/** @type {EslintConfig} */
const esNextBase = {
    name: 'doubleaxe/esNext',
    rules: {
        ...esNextRulesBase,
        'simple-import-sort/imports': 'error',
        'simple-import-sort/exports': 'error',
    },
    plugins: { 'simple-import-sort': simpleImportSortPlugin },
    languageOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        globals: {
            ...globals.es2024,
        },
        parserOptions: {
            ecmaFeatures: {
                impliedStrict: true,
                jsx: true,
            },
        },
    },
    settings: {},
};

export default {
    baseConfigs: {
        ...root.baseConfigs,
        esNextBase,
    },
    configs: {
        ...root.configs,
    },
    patterns: root.patterns,
    utils: root.utils,
    globals,
};
