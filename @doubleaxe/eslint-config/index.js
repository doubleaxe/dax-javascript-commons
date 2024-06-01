const jsconfig = require('@doubleaxe/eslint-config/javascript');

module.exports = {
    configs: {
        ...jsconfig.configs,
    },
    utils: jsconfig.utils,
};
