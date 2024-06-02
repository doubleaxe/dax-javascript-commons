const jsconfig = require('./javascript');

module.exports = {
    configs: {
        ...jsconfig.configs,
    },
    utils: jsconfig.utils,
};
