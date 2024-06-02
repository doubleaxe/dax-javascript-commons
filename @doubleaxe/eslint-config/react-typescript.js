const react = require('./react-javascript');
const tsconfig = require('./typescript');

/** @type {import("eslint").Linter.RulesRecord} */
const rules = {
    'react/boolean-prop-naming': 'error',
};
/** @type {import("eslint").Linter.FlatConfig[]} */
const recommended = tsconfig.utils.extendFiles(
    [
        ...react.configs.react.recommended,
        {
            name: 'doubleaxe/recommended/react',
            rules,
        },
    ],
    '**/*.tsx',
    '**/*.mtsx'
);

module.exports = {
    configs: {
        ...tsconfig.configs,
        react: {
            recommended,
        },
    },
    utils: tsconfig.utils,
};
