import reactTs from '@doubleaxe/eslint-config/src/react-ts.js';
import vueTs from '@doubleaxe/eslint-config/src/vue-ts.js';
import { defineConfig } from 'eslint/config';

const config = defineConfig(
    reactTs.configs.esNextTools,
    reactTs.configs.reactTs,
    vueTs.utils.extendFiles(vueTs.configs.vueTs, vueTs.patterns.vueFilter, true)
);
//console.dir(config, { depth: 3, colors: true });
export default config;
