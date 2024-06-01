/** @type {import("eslint").Linter.FlatConfig[]} */
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
    extendFilesIf(configs, testFn, ...patterns) {
        return configs.map((config) => {
            const keys = Object.keys(config);
            if (keys.length === 1 && keys[0] === 'ignores') {
                // global ignores
                return config;
            }
            return {
                ...config,
                files: patterns.reduce((files, pattern) => {
                    if (testFn && !files?.some((file) => testFn(file))) {
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
    },
    utils,
};
