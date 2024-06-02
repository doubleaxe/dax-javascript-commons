const path = require('node:path');

const { FlatCompat } = require('@eslint/eslintrc');
const react = require('eslint-plugin-react/configs/recommended');
const hooks = require('eslint-plugin-react-hooks');

const jsconfig = require('./javascript');

const compat = new FlatCompat({
    baseDirectory: path.dirname(require.resolve('eslint-plugin-react-hooks')),
});

/** @type {import("eslint").Linter.RulesRecord} */
const rules = {
    'react/button-has-type': 'error',
    'react/function-component-definition': 'error',
    'react/hook-use-state': 'error',
    'react/jsx-boolean-value': 'error',
    'react/jsx-filename-extension': ['error', { allow: 'as-needed', extensions: ['.jsx', '.mjsx', '.tsx', '.mtsx'] }],
    'react/jsx-fragments': 'error',
    'react/jsx-handler-names': 'error',
    'react/jsx-no-constructed-context-values': 'error',
    'react/jsx-no-script-url': 'error',
    'react/jsx-pascal-case': 'error',
    'react/jsx-sort-props': 'error',
    'react/no-access-state-in-setstate': 'error',
    'react/no-danger': 'error',
    'react/no-namespace': 'error',
    'react/no-object-type-as-default-prop': 'error',
    'react/no-redundant-should-component-update': 'error',
    'react/no-this-in-sfc': 'error',
    'react/style-prop-object': 'error',
};
/** @type {import("eslint").Linter.FlatConfig[]} */
const recommended = jsconfig.utils.extendFiles(
    [
        react,
        ...compat.config(hooks.configs.recommended),
        {
            name: 'doubleaxe/recommended/react',
            rules,
            settings: {
                react: {
                    version: 'detect',
                },
            },
        },
    ],
    '**/*.jsx',
    '**/*.mjsx'
);

module.exports = {
    configs: {
        ...jsconfig.configs,
        react: {
            recommended,
        },
    },
    utils: jsconfig.utils,
};
