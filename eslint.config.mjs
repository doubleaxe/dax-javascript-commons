import es from '@doubleaxe/eslint-config/ts';
import { defineConfig } from 'eslint/config';

const config = defineConfig(...es.configs.ts, ...es.configs.node, {
    ignores: ['test', '@doubleaxe/eslint-config/types', '@doubleaxe/eslint-config/dist'],
});
export default config;
