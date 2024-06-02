const jsconfig = require('@doubleaxe/eslint-config/javascript');
const globals = require('globals');

module.exports = [
    ...jsconfig.configs.root,
    ...jsconfig.configs.recommended,
    ...jsconfig.configs.importSortCommonjs,
    { languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } } },
];
