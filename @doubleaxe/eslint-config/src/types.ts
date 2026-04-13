import type { ESLint, Linter } from 'eslint';

import type { Utils } from './utils.js';

export type EslintConfig = Linter.Config;
export type EslintRules = Linter.RulesRecord;
export type EslintPlugin = ESLint.Plugin;

export type EslintSimpleSharedConfig = {
    baseConfigs: Record<string, EslintConfig>;
    configs: Record<string, EslintConfig[]>;
    plugins: Record<string, EslintPlugin>;
};

export type EslintSharedConfigs = {
    globals: Record<string, Record<string, boolean>>;
    patterns: Record<string, string[]>;
    utils: Utils;
} & EslintSimpleSharedConfig;
