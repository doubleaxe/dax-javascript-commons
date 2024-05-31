const js = require('@eslint/js');
const globals = require('globals');

const root = [
    {
        ignores: [
            '**/node_modules/',
            '.git/',
            '**/dist*/',
            '**/vendor/',
            '**/*.min.js',
            '**/eslint.config.cjs',
            '**/.prettierrc.*',
        ],
    },
];

const utils = {
    extendFiles(configs, ...patterns) {
        return utils.extendFilesIf(configs, undefined, ...patterns);
    },
    extendFilesIf(configs, fileIf, ...patterns) {
        return configs.map((config) => {
            const keys = Object.keys(config);
            if (keys.length == 1 && keys[0] == 'ignores') {
                //global ignores
                return config;
            }
            return {
                ...config,
                files: patterns.reduce((files, pattern) => {
                    if (fileIf && !files?.includes(fileIf)) {
                        return files;
                    }
                    if (files?.some((file) => file === pattern)) {
                        return files;
                    }
                    return (files || []).concat([pattern]);
                }, config.files),
            };
        });
    },
};

module.exports = {
    configs: {
        root,
        recommended: [
            ...root,
            js.configs.recommended,
            {
                name: 'doubleaxe/recommended',
                languageOptions: {
                    ecmaVersion: 2023,
                    globals: { ...globals.es2021 },
                },
            },
        ],
    },
    utils,
};
