import reactTs from '@doubleaxe/eslint-config/src/react-ts.js';
import { defineConfig } from 'eslint/config';

const config = defineConfig(reactTs.configs.esNextTools, reactTs.configs.reactTs);
//console.dir(config, { depth: 3, colors: true });
export default config;
