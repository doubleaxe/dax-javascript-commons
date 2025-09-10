import globals from 'globals';

/**
 * @typedef EslintConfig
 * @type {import("eslint").Linter.Config}
 */
/**
 * @typedef EslintRules
 * @type {import("eslint").Linter.RulesRecord}
 */

const ignores = ['**/node_modules/', '.git/', '.hg/', '**/dist*/', '**/vendor/', '**/*.min.js'];

const toolsEs = [
    '**/eslint.config.{js,mjs}',
    '**/.prettierrc.{js,mjs}',
    '**/.pnpmfile.{js,mjs}',
    '**/webpack.config.mjs',
    '**/stylelint.config.{js,mjs}',
    '**/postcss.config.{js,mjs}',
    '**/tailwind.config.{js,mjs}',
    '**/jest.config.{js,mjs}',
    '**/vitest.config.{js,mjs}',
    '**/karma.conf.{js,mjs}',
    '**/vite.config.{js,mjs}',
    '**/rollup.config.{js,mjs}',
    '**/esbuild.config.{js,mjs}',
];

const toolsTs = [
    '**/jest.config.ts',
    '**/vitest.config.ts',
    '**/karma.conf.ts',
    '**/vite.config.ts',
    '**/rollup.config.ts',
    '**/esbuild.config.ts',
];

const esExtensions = ['js', 'mjs', 'jsx'];
const esFilter = esExtensions.map((ext) => `**/*.${ext}`);

const tsExtensions = ['ts', 'mts', 'tsx'];
const tsFilter = tsExtensions.map((ext) => `**/*.${ext}`);

const vueExtensions = ['vue'];
const vueFilter = vueExtensions.map((ext) => `**/*.${ext}`);

const utils = {
    /**
     * @param {EslintConfig[]} configs
     * @param {string[]} files
     * @param {boolean | undefined} [replace]
     * @returns {EslintConfig[]}
     */
    extendFiles(configs, files, replace) {
        return configs.map((config) => {
            const keys = Object.keys(config);
            if (keys.length === 1 && keys[0] === 'ignores') {
                // global ignores
                return config;
            }
            if (replace) {
                return {
                    ...config,
                    files,
                };
            }
            return {
                ...config,
                files: (config.files ?? []).concat(files.filter((file) => !config.files?.includes(file))),
            };
        });
    },
};

/** @type {EslintConfig[]} */
const root = [
    {
        name: 'doubleaxe/root',
        ignores,
    },
];

export default {
    baseConfigs: {},
    configs: {
        root,
    },
    patterns: {
        ignores,
        toolsEs,
        toolsTs,
        esExtensions,
        tsExtensions,
        vueExtensions,
        esFilter,
        tsFilter,
        vueFilter,
    },
    utils,
    globals,
};
