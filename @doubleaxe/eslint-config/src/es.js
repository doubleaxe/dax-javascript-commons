import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import perfectionist from 'eslint-plugin-perfectionist';
import simpleImportSortPlugin from 'eslint-plugin-simple-import-sort';
import globals from 'globals';

import browser from './browser.js';
import node from './node.js';
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
            allowVoid: false,
            checkForEach: false,
        },
    ],
    'camelcase': [
        'error',
        {
            ignoreDestructuring: true,
            ignoreGlobals: true,
            ignoreImports: true,
            properties: 'never',
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
    'eqeqeq': ['error'],
    'grouped-accessor-pairs': ['error'],
    'no-alert': ['warn'],
    'no-array-constructor': ['error'],
    'no-caller': ['error'],
    'no-constructor-return': ['error'],
    'no-duplicate-imports': [
        'error',
        {
            allowSeparateTypeImports: true,
            includeExports: true,
        },
    ],
    'no-else-return': [
        'error',
        {
            allowElseIf: true,
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
    'no-labels': ['error'],
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
    'no-restricted-exports': [
        'error',
        {
            restrictedNamedExports: ['default', 'then'],
        },
    ],
    'no-restricted-globals': [
        'error',
        {
            message: 'Use Number.isFinite instead https://github.com/airbnb/javascript#standard-library--isfinite',
            name: 'isFinite',
        },
        {
            message: 'Use Number.isNaN instead https://github.com/airbnb/javascript#standard-library--isnan',
            name: 'isNaN',
        },
    ],
    'no-restricted-properties': [
        'error',
        {
            message: 'arguments.callee is deprecated',
            object: 'arguments',
            property: 'callee',
        },
        {
            message: 'Please use Object.defineProperty instead.',
            property: '__defineGetter__',
        },
        {
            message: 'Please use Object.defineProperty instead.',
            property: '__defineSetter__',
        },
    ],
    'no-return-assign': ['error', 'always'],
    'no-script-url': ['error'],
    'no-self-compare': ['error'],
    'no-sequences': ['error'],
    'no-shadow': [
        'error',
        {
            builtinGlobals: true,
        },
    ],
    'no-template-curly-in-string': ['error'],
    'no-throw-literal': ['error'],
    'no-unassigned-vars': ['error'],
    'no-undef-init': ['error'],
    'no-unmodified-loop-condition': ['error'],
    'no-unneeded-ternary': ['error'],
    'no-unreachable-loop': ['error'],
    'no-unused-expressions': [
        'error',
        {
            allowShortCircuit: true,
            allowTaggedTemplates: false,
            allowTernary: true,
            enforceForJSX: false,
        },
    ],
    'no-unused-vars': [
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
    'no-use-before-define': [
        'error',
        {
            classes: false,
            functions: false,
        },
    ],
    'no-useless-assignment': ['error'],
    'no-useless-computed-key': ['error'],
    'no-useless-concat': ['error'],
    'no-useless-constructor': ['error'],
    'no-useless-rename': ['error'],
    'no-useless-return': ['error'],
    'no-var': ['error'],
    'no-void': ['error'],
    'object-shorthand': [
        'error',
        'always',
        {
            avoidQuotes: true,
        },
    ],
    'one-var': ['error', 'never'],
    'prefer-arrow-callback': ['error'],
    'prefer-const': [
        'error',
        {
            destructuring: 'all',
            ignoreReadBeforeAssign: true,
        },
    ],
    'prefer-exponentiation-operator': ['error'],
    'prefer-numeric-literals': ['error'],
    'prefer-object-spread': ['error'],
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
    'prefer-rest-params': ['error'],
    'prefer-spread': ['error'],
    'prefer-template': ['error'],
    'radix': ['error'],
    'require-await': 'error',
    'symbol-description': ['error'],
    'unicode-bom': ['error', 'never'],
    'yoda': ['error'],
};

/** @type {EslintConfig} */
const esNextBase = {
    name: 'doubleaxe/esNext',
    rules: {
        ...esNextRulesBase,

        // only rules that don't require resolution (resolution is slow, complex to setup and buggy)
        'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
        'import/no-absolute-path': ['error'],
        'import/no-commonjs': ['error'],
        'import/no-duplicates': ['error'],
        'import/no-mutable-exports': ['error'],

        'perfectionist/sort-array-includes': ['error'],
        'perfectionist/sort-decorators': ['error'],
        'perfectionist/sort-heritage-clauses': ['error'],
        'perfectionist/sort-interfaces': ['error'],
        'perfectionist/sort-intersection-types': ['error'],
        'perfectionist/sort-jsx-props': ['error'],
        'perfectionist/sort-maps': ['error'],
        'perfectionist/sort-object-types': ['error'],
        'perfectionist/sort-sets': ['error'],
        'perfectionist/sort-switch-case': ['error'],
        'perfectionist/sort-union-types': ['error'],

        'simple-import-sort/exports': ['error'],
        'simple-import-sort/imports': ['error'],
    },
    plugins: {
        'import': importPlugin,
        perfectionist,
        'simple-import-sort': simpleImportSortPlugin,
    },
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

const esRecommended = { ...js.configs.recommended, name: 'eslint/recommended' };
const esNextRoot = defineConfig(root.configs.root, esRecommended, esNextBase);

const esNext = root.utils.extendFiles(esNextRoot, root.patterns.esFilter);

const esNextTools = root.utils.extendFiles(defineConfig(esNextRoot, node.configs.node), root.patterns.toolsEs);

export default {
    ...root,
    baseConfigs: {
        ...root.baseConfigs,
        ...browser.baseConfigs,
        ...node.baseConfigs,
        esNextBase,
    },
    configs: {
        ...root.configs,
        ...browser.configs,
        ...node.configs,
        esNextRoot,
        esNext,
        esNextTools,
    },
};
