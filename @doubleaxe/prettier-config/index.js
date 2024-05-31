/** @type {import("prettier").Options} */
const config = {
    printWidth: 120,
    tabWidth: 4,
    useTabs: false,
    semi: true,
    singleQuote: true,
    jsxSingleQuote: true,
    quoteProps: 'consistent',
    trailingComma: 'es5',
    bracketSpacing: true,
    arrowParens: 'always',
    endOfLine: 'lf',
    overrides: [
        {
            files: '*.json',
            options: { tabWidth: 2 },
        },
        {
            files: ['*.yml', '*.yaml'],
            options: { tabWidth: 2 },
        },
    ],
};

module.exports = config;
