import * as path from 'node:path';

export function normalizePathForCompare(value: string, caseInsensitive: boolean): string {
    const normalized = path.normalize(value);
    return caseInsensitive ? normalized.toLowerCase() : normalized;
}

export type ResolveInputBase = {
    caseInsensitive?: boolean;
    extensions?: readonly string[];
    importerFile: string;
    specifier: string;
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

export function buildResolveInput<T extends ResolveInputBase>(
    input: T,
    options: {
        caseInsensitive?: boolean;
        extensions?: readonly string[];
        manualTsConfigs?: unknown;
        usePackageJson?: boolean;
        useTsConfig?: boolean;
    },
    specifier: string
): T {
    return {
        ...input,
        specifier,
        extensions: options.extensions,
        caseInsensitive: options.caseInsensitive,
        usePackageJson: options.usePackageJson,
        useTsConfig: options.useTsConfig,
        manualTsConfigs: options.manualTsConfigs,
    } as T;
}
