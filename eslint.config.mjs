import es from '@doubleaxe/eslint-config/ts';
import { defineConfig } from 'eslint/config';

const config = defineConfig(...es.configs.ts, ...es.configs.node, {
    ignores: [
        'test',
        '@doubleaxe/eslint-config/types',
        '@doubleaxe/eslint-config/dist',
        '@doubleaxe/eslint-plugin-import-paths-extensions/types',
        '@doubleaxe/eslint-plugin-import-paths-extensions/dist',
        '@doubleaxe/eslint-plugin-import-paths-extensions/test-assets',
    ],
});
export default config;
