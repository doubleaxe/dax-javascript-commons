import type { ManualAliasEntry } from '../../types.js';

export type ExtensionsCoreOptions = {
    extensionAlias?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    manualAliases?: readonly ManualAliasEntry[];
    preferDirectoryIndex?: boolean;
    preferExtension?: boolean;
    resolveCacheTtl?: number;
    usePackageJson?: boolean | readonly string[] | string;
    useTsConfig?: boolean | readonly string[] | string;
};

export type ExtensionsDecision = {
    nextSpecifier?: string;
    reason: 'changed' | 'unchanged' | 'unresolved' | 'unsafe';
    resolvedFile?: string;
};
