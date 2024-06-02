const ts = require('typescript-eslint');

const jsconfig = require('./javascript');

// typescript recommended are much better than alloy ones for typescript
/** @type {import("eslint").Linter.RulesRecord} */
const rules = {
    'default-param-last': 'off',
    '@typescript-eslint/default-param-last': 'error',
    '@typescript-eslint/await-thenable': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/ban-tslint-comment': 'off',
    // we have verbatimModuleSyntax
    '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    '@typescript-eslint/member-ordering': 'error',
    '@typescript-eslint/method-signature-style': 'error',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-import-type-side-effects': 'error',
    '@typescript-eslint/no-invalid-void-type': 'error',
    'no-loop-func': 'off',
    '@typescript-eslint/no-loop-func': 'error',
    '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
    'no-unused-expressions': 'off',
    '@typescript-eslint/no-unused-expressions': [
        'error',
        {
            allowShortCircuit: true,
            allowTernary: true,
            allowTaggedTemplates: true,
            enforceForJSX: false,
        },
    ],
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': [
        'error',
        {
            variables: false,
            functions: false,
            classes: false,
            typedefs: false,
        },
    ],
    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': 'error',
    'no-throw-literal': 'off',
    '@typescript-eslint/only-throw-error': 'error',
    '@typescript-eslint/unified-signatures': 'error',
};

/** @type {import("eslint").Linter.FlatConfig[]} */
const recommended = jsconfig.utils.extendFiles(
    [
        ...ts.configs.recommendedTypeChecked,
        // without duplicate base configs
        ts.configs.stylisticTypeChecked[ts.configs.stylisticTypeChecked.length - 1],
        {
            name: 'doubleaxe/recommended/typescript',
            languageOptions: {
                parserOptions: {
                    project: true,
                    extraFileExtensions: ['.vue'],
                    sourceType: 'module',
                },
            },
            rules,
            settings: {
                'import/resolver': {
                    typescript: true,
                    node: {
                        extensions: ['.mjs', '.cjs', '.js', '.json', '.mts', '.cts', '.ts', '.d.ts'],
                    },
                },
                'import/parsers': {
                    '@typescript-eslint/parser': ['.mts', '.cts', '.ts', '.tsx', '.mtsx', '.d.ts'],
                },
                'import/extensions': [
                    '.mjs',
                    '.cjs',
                    '.js',
                    '.jsx',
                    '.mjsx',
                    '.mts',
                    '.cts',
                    '.ts',
                    '.tsx',
                    '.mtsx',
                    '.d.ts',
                ],
            },
        },
    ],
    '**/*.mts',
    '**/*.cts',
    '**/*.ts',
    '**/*.tsx',
    '**/*.mtsx'
);

module.exports = {
    configs: {
        ...jsconfig.configs,
        typescript: {
            recommended,
        },
    },
    utils: jsconfig.utils,
};
