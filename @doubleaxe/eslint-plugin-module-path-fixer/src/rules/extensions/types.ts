import type { ManualTsConfigEntry, ResolvedImport, ResolveImportOptions } from '../../resolve.js';

export type ExtensionsMode = 'always' | 'never';

export type ExtensionsCoreOptions = {
    caseInsensitive?: boolean;
    extension: ExtensionsMode;
    extensionMapping?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    index: ExtensionsMode;
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

export type ExtensionsInput = {
    importerFile: string;
    specifier: string;
};

export type ExtensionsDecisionReason = 'extension-and-index' | 'extension' | 'index';

export type ExtensionsDecision = {
    kind: 'rewrite';
    nextSpecifier: string;
    reason: ExtensionsDecisionReason;
    resolved: ResolvedImport;
};

export type ResolverLike = {
    resolve: (options: ResolveImportOptions) => null | ResolvedImport;
};
