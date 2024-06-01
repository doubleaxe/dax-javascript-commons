const alloy = require('eslint-config-alloy/base');
const importPlugin = require('eslint-plugin-import');
const globals = require('globals');

const root = require('./root');

/** @type {import("eslint").Linter.RulesRecord} */
const rules = {
    'default-param-last': ['error'],
    'dot-notation': [
        'error',
        {
            allowKeywords: true,
            allowPattern: '',
        },
    ],
    'global-require': ['error'],
    'import/export': ['error'],
    'import/extensions': [
        'error',
        'ignorePackages',
        {
            js: 'never',
            mjs: 'never',
            jsx: 'never',
        },
    ],
    'import/no-absolute-path': ['error'],
    'import/no-duplicates': ['error'],
    'import/no-mutable-exports': ['error'],
    'import/no-self-import': ['error'],
    'import/no-useless-path-segments': [
        'error',
        {
            noUselessIndex: true,
            commonjs: true,
        },
    ],
    'import/order': [
        'error',
        {
            'groups': ['builtin', 'external', 'parent', 'sibling', 'type'],
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
    'no-multi-assign': ['error'],
    'no-nested-ternary': ['error'],
    'no-param-reassign': ['off'],
    'no-shadow': ['error'],
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
                },
            },
        },
        plugins: { import: importPlugin },
        rules,
        settings: {
            'import/resolver': {
                node: {
                    extensions: ['.mjs', '.js', '.json'],
                },
            },
            'import/extensions': ['.js', '.mjs', '.jsx'],
            'import/core-modules': [],
            'import/ignore': ['node_modules', '\\.(coffee|scss|css|less|hbs|svg|json)$'],
        },
    },
];

module.exports = {
    configs: {
        ...root.configs,
        recommended,
    },
    utils: root.utils,
};
