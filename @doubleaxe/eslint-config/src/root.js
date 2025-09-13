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

const tools = [
    'eslint.config',
    '.prettierrc',
    '.pnpmfile',
    'webpack.config',
    'stylelint.config',
    'postcss.config',
    'tailwind.config',
    'jest.config',
    'vitest.config',
    'karma.conf',
    'vite.config',
    'rollup.config',
    'esbuild.config',
];

// only modules supported for simplicity
const toolsEs = tools.map((tool) => `**/${tool}.{js,mjs}`);
const toolsTs = tools.map((tool) => `**/${tool}.{ts,mts}`);

const esExtensions = ['js', 'mjs', 'jsx'];
const esFilter = esExtensions.map((ext) => `**/*.${ext}`);

const tsExtensions = ['ts', 'mts', 'tsx'];
const tsFilter = tsExtensions.map((ext) => `**/*.${ext}`);

const vueExtensions = ['vue'];
const vueFilter = vueExtensions.map((ext) => `**/*.${ext}`);

/**
 * @typedef EslintPlugin
 * @type {import("eslint").ESLint.Plugin}
 */

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
    /**
     * @param {EslintPlugin} plugin
     * @returns {EslintPlugin}
     */
    inferPlugin(plugin) {
        // necessary for tsc
        return plugin;
    },
};

/** @type {EslintConfig[]} */
const root = [
    {
        ignores,
    },
    {
        name: 'doubleaxe/root',
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
            reportUnusedInlineConfigs: 'error',
        },
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
    plugins: {},
};
