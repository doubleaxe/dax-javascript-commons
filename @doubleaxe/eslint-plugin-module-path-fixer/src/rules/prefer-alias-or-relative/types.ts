import type { ManualTsConfigEntry, ResolvedImport } from '../../resolve.js';

export type PreferAliasOrRelativeCoreOptions = {
    extensionAlias?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    maxFolderSegments?: number;
    maxParentSegments?: number;
    optimization?: 'none' | 'shorter' | 'shorterEqual';
    resolveCacheTtl?: number;
    usePackageJson?: boolean;
    useTsConfig?: boolean | readonly string[] | string;
};

export type PreferAliasOrRelativeDecision = {
    nextSpecifier?: string;
    reason: 'changed' | 'unchanged' | 'unresolved' | 'unsafe';
    resolved?: ResolvedImport;
};
