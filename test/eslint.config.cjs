const reactconfig = require('@doubleaxe/eslint-config/react-typescript');

const config = [
    ...reactconfig.configs.root,
    ...reactconfig.configs.recommended,
    ...reactconfig.configs.typescript.recommended,
    ...reactconfig.configs.react.recommended,
];
//console.dir(config, { depth: 3, colors: true });
module.exports = config;
