import globals from 'globals';

import type { EslintConfig, EslintSharedConfigs } from './types.js';
import utils from './utils.js';

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

const jsxExtensions = ['jsx'];
const jsxFilter = jsxExtensions.map((ext) => `**/*.${ext}`);

const esExtensions = ['js', 'mjs', ...jsxExtensions];
const esFilter = esExtensions.map((ext) => `**/*.${ext}`);

const tsxExtensions = ['tsx'];
const tsxFilter = tsxExtensions.map((ext) => `**/*.${ext}`);

const tsExtensions = ['ts', 'mts', ...tsxExtensions];
const tsFilter = tsExtensions.map((ext) => `**/*.${ext}`);

const vueExtensions = ['vue'];
const vueFilter = vueExtensions.map((ext) => `**/*.${ext}`);

const root: EslintConfig[] = [
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

/**
 * less size for *.d.ts
 */
const inferGlobals: Record<string, Record<string, boolean>> = globals;

export default {
    baseConfigs: {},
    configs: {
        root,
    },
    patterns: {
        ignores,
        tools,
        toolsEs,
        toolsTs,
        esExtensions,
        tsExtensions,
        jsxExtensions,
        tsxExtensions,
        vueExtensions,
        esFilter,
        tsFilter,
        jsxFilter,
        tsxFilter,
        vueFilter,
    },
    utils,
    globals: inferGlobals,
    plugins: {},
} satisfies EslintSharedConfigs;
