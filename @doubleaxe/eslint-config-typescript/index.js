const jsconfig = require('@doubleaxe/eslint-config');

module.exports = {
    configs: {
        recommended: [
            ...jsconfig.configs.recommended,
            {
                name: 'doubleaxe/recommended/typescript',
            },
        ],
    },
    utils: jsconfig.utils,
};
