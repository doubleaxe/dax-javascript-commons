import type { ManualTsConfigEntry, ResolvedImport } from '../../resolve.js';

export type ExtensionsCoreOptions = {
    extensionMapping?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    preferDirectoryIndex?: boolean;
    preferExtension?: boolean;
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

export type ExtensionsDecisionReason = 'extension-and-index' | 'extension' | 'index';

export type ExtensionsDecision = {
    kind: 'rewrite';
    nextSpecifier: string;
    reason: ExtensionsDecisionReason;
    resolved: ResolvedImport;
};
