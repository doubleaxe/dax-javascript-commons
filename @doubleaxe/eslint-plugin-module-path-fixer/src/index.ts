import { extensionsRule } from './rule-extensions.js';
import { preferAliasOrRelativeRule } from './rule-prefer-alias-or-relative.js';

export const rules = {
    'extensions': extensionsRule,
    'prefer-alias-or-relative': preferAliasOrRelativeRule,
} as const;

export const configs = {
    recommended: {
        settings: {
            'module-path-fixer': {
                useTsConfig: true,
                usePackageJson: true,
            },
        },
        rules: {
            'module-path-fixer/prefer-alias-or-relative': 'error',
            'module-path-fixer/extensions': 'error',
        },
    },
} as const;

const plugin = {
    rules,
    configs,
} as const;

export type ModulePathFixerPlugin = typeof plugin;

export default plugin;
