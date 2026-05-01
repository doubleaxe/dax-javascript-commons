import type { ManualTsConfigEntry, ResolvedImport } from '../../resolve.js';

export type PreferAliasOrRelativeCoreOptions = {
    childFolderAliasDepth?: number;
    extensionAlias?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    parentFolderAliasDepth?: number;
    preferFolderAlias?: boolean;
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

export type PreferAliasOrRelativeDecisionKind = 'normalize' | 'to-alias' | 'to-relative';

export type PreferAliasOrRelativeDecision = {
    kind: PreferAliasOrRelativeDecisionKind;
    nextSpecifier: string;
    resolved: ResolvedImport;
};
