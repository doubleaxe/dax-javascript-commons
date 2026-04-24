import type { ManualTsConfigEntry, ResolvedImport,ResolveImportOptions } from '../../resolve.js';

export type PreferAliasOrRelativeCoreOptions = {
    caseInsensitive?: boolean;
    depth?: number;
    extensions?: readonly string[];
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

export type PreferAliasOrRelativeInput = {
    importerFile: string;
    specifier: string;
};

export type PreferAliasOrRelativeDecisionKind = 'to-alias' | 'to-relative';

export type PreferAliasOrRelativeDecision = {
    kind: PreferAliasOrRelativeDecisionKind;
    nextSpecifier: string;
    resolved: ResolvedImport;
};

export type ResolverLike = {
    resolve: (options: ResolveImportOptions) => null | ResolvedImport;
};
