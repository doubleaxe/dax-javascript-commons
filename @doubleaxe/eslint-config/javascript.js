const alloy = require('eslint-config-alloy/base');
const importPlugin = require('eslint-plugin-import');
const simpleImportSortPlugin = require('eslint-plugin-simple-import-sort');
const globals = require('globals');

const root = require('./root');

/** @type {import("eslint").Linter.RulesRecord} */
const rules = {
    'default-param-last': 'error',
    'dot-notation': [
        'error',
        {
            allowKeywords: true,
            allowPattern: '',
        },
    ],
    'global-require': 'error',
    'import/export': 'error',
    'import/extensions': [
        'error',
        'ignorePackages',
        {
            mjs: 'never',
            cjs: 'never',
            js: 'never',
            jsx: 'never',
        },
    ],
    'import/no-absolute-path': 'error',
    'import/no-duplicates': 'error',
    'import/no-mutable-exports': 'error',
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': [
        'error',
        {
            noUselessIndex: true,
            commonjs: true,
        },
    ],
    'max-params': 'off',
    'no-loop-func': 'error',
    'no-multi-assign': 'error',
    'no-nested-ternary': 'error',
    'no-param-reassign': 'off',
    'no-with': 'error',
    'object-shorthand': [
        'error',
        'always',
        {
            ignoreConstructors: false,
            avoidQuotes: true,
        },
    ],
    'prefer-const': [
        'error',
        {
            destructuring: 'any',
            ignoreReadBeforeAssign: true,
        },
    ],
    'require-await': 'error',
};

/** @type {import("eslint").Linter.FlatConfig[]} */
const recommended = [
    {
        rules: alloy.rules,
    },
    {
        name: 'doubleaxe/recommended/javascript',
        languageOptions: {
            ecmaVersion: 2023,
            globals: { ...globals.es2021 },
            parserOptions: {
                ecmaFeatures: {
                    impliedStrict: true,
                    jsx: true,
                },
            },
        },
        plugins: { import: importPlugin },
        rules,
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.mjs', '.cjs', '.js', '.json'],
                },
            },
            'import/extensions': ['.mjs', '.cjs', '.js', '.jsx', '.mjsx'],
            'import/core-modules': [],
            'import/ignore': ['node_modules', '\\.(coffee|scss|css|less|hbs|svg|json)$'],
        },
    },
];

/** @type {import("eslint").Linter.FlatConfig[]} */
const importSortCommonjs = [
    {
        rules: {
            'import/order': [
                'error',
                {
                    'groups': ['builtin', ['external', 'internal'], 'parent', 'sibling', 'type'],
                    'newlines-between': 'always-and-inside-groups',
                    'alphabetize': {
                        order: 'asc',
                        caseInsensitive: false,
                        orderImportKind: 'ignore',
                    },
                    'distinctGroup': true,
                    'warnOnUnassignedImports': false,
                },
            ],
        },
    },
];

/** @type {import("eslint").Linter.FlatConfig[]} */
const importSortSimple = [
    {
        plugins: { 'simple-import-sort': simpleImportSortPlugin },
        rules: {
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
        },
    },
];

module.exports = {
    configs: {
        ...root.configs,
        recommended,
        importSortCommonjs,
        importSortSimple,
    },
    utils: root.utils,
};
