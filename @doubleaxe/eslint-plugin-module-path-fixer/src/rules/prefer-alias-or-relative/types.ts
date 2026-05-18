import type { ManualTsConfigEntry, ResolvedImport } from '../../resolve.js';

export type PreferAliasOrRelativeCoreOptions = {
    extensionAlias?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    maxChildFolderSegments?: number;
    maxParentSegments?: number;
    optimization?: 'none' | 'shorter' | 'shorterEqual';
    resolveCacheTtl?: number;
    usePackageJson?: boolean | readonly string[] | string;
    useTotalParentSegments?: boolean;
    useTsConfig?: boolean | readonly string[] | string;
};

export type SpecifierReason = 'found' | 'unresolved' | 'unsafe';
export type DecisionKind = 'alias-depth' | 'alias-optimized' | 'relative' | 'unresolved';
export type PreferAliasOrRelativeDecision = {
    aliasReason?: SpecifierReason;
    kind: DecisionKind;
    nextSpecifier?: string;
    relativeReason?: SpecifierReason;
    resolved?: ResolvedImport;
};
