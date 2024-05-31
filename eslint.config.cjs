const jsconfig = require('@doubleaxe/eslint-config');
const globals = require('globals');

module.exports = [
    ...jsconfig.configs.recommended,
    { languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } } },
];
