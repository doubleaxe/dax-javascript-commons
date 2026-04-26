import type { ManualTsConfigEntry, ResolvedImport } from '../../resolve.js';

export type PreferAliasOrRelativeCoreOptions = {
    caseInsensitive?: boolean;
    extensions?: readonly string[];
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    parentFolderAliasDepth?: number;
    preferFolderAlias?: boolean;
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
