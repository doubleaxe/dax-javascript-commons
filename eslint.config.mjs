import es from '@doubleaxe/eslint-config/ts';
import { defineConfig } from 'eslint/config';

const config = defineConfig(...es.configs.ts, ...es.configs.node, {
    ignores: [
        'test',
        '@doubleaxe/eslint-config/types',
        '@doubleaxe/eslint-config/dist',
        '@doubleaxe/eslint-plugin-module-path-fixer/types',
        '@doubleaxe/eslint-plugin-module-path-fixer/dist',
        '@doubleaxe/eslint-plugin-module-path-fixer/test-assets',
    ],
});
export default config;
