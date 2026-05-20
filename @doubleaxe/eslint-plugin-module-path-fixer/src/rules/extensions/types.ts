import type { AliasEntry } from '../../alias/types.js';

export type ExtensionsCoreOptions = {
    extensionAlias?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    manualAliases?: readonly AliasEntry[];
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
