import * as fs from 'node:fs';
import * as path from 'node:path/posix';

import { LRUCache } from 'lru-cache';

import { type AliasParser, buildAbsoluteAliasOptions, createAliasParser } from './alias/alias-parser.js';
import type { AbsolutePathAliasArray, AliasCacheEntry, AliasEntry, ResolvedPath } from './alias/types.js';
import { resolveAliasTargetPath, tryResolveTargetPath } from './alias/utils.js';
import { createFsCache } from './fscache.js';
import { normalizePath } from './normalizer.js';
import type {
    ManualAliasEntry,
    ResolvedSpecifierKindType,
    ReverseExtensionAlias,
    SpecifierClassType,
} from './types.js';

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'] as const;
const DEFAULT_EXTENSION_ALIAS = {
    '.ts': '.js',
    '.tsx': '.jsx',
    '.mts': '.mjs',
    '.cts': '.cjs',
} as const;

export type ResolvedImport = Readonly<{
    importerDir: string;
    resolvedFile: string;
    specifierClass: SpecifierClassType;
    specifierKind: ResolvedSpecifierKindType;
}>;

export type ResolveInput = {
    // system separator
    importerFile: string;
    // normalized to posix
    specifier: string;
};

export type ResolveInputDir = {
    importerDir: string;
    specifier: string;
};

export type ResolveImportOptions = {
    errorLog?: boolean;
    extensionAlias?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    manualAliases?: readonly ManualAliasEntry[];
    resolveCacheTtl?: number;
    usePackageJson?: boolean | readonly string[] | string;
    useTsConfig?: boolean | readonly string[] | string;
};

type NormaizedResolveImportOptions = {
    manualAliases: readonly AliasEntry[];
    packageJsonNames: string[] | undefined;
    tsconfigNames: string[] | undefined;
} & Required<Omit<ResolveImportOptions, 'manualAliases' | 'usePackageJson' | 'useTsConfig'>>;

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function hasStringArray(values: unknown): values is readonly string[] {
    return Array.isArray(values) && values.every((item) => typeof item === 'string' && item.length > 0);
}

function normalizeManualPathsRecord(paths: unknown): Readonly<Record<string, readonly string[]>> {
    if (!isObject(paths)) {
        return {};
    }

    const normalized: Record<string, readonly string[]> = {};
    for (const [alias, aliasPaths] of Object.entries(paths)) {
        if (alias.length === 0 || !hasStringArray(aliasPaths) || aliasPaths.length === 0) {
            continue;
        }

        normalized[alias] = [...aliasPaths];
    }

    return normalized;
}

function isManualAliasEntry(value: unknown): value is ManualAliasEntry {
    return (
        isObject(value) &&
        typeof value['baseUrl'] === 'string' &&
        value['baseUrl'].length > 0 &&
        isObject(value['paths'])
    );
}

function normalizeManualAliases(manualAliases: readonly ManualAliasEntry[] | undefined): readonly AliasEntry[] {
    return (manualAliases ?? [])
        .filter((entry) => isManualAliasEntry(entry))
        .map(
            (entry) =>
                ({
                    baseUrl: entry.baseUrl,
                    paths: normalizeManualPathsRecord(entry.paths),
                    source: 'manual',
                }) satisfies AliasEntry
        )
        .filter((entry) => Object.keys(entry.paths).length > 0);
}

function normalizeExtensionToken(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }

    return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

function normalizeExtensionAliases(
    extensionAlias: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> {
    if (!extensionAlias) {
        return DEFAULT_EXTENSION_ALIAS;
    }

    const normalized: Record<string, string> = {};
    for (const [sourceExtension, targetExtension] of Object.entries(extensionAlias)) {
        if (typeof sourceExtension !== 'string' || typeof targetExtension !== 'string') {
            continue;
        }

        const normalizedSource = normalizeExtensionToken(sourceExtension);
        const normalizedTarget = normalizeExtensionToken(targetExtension);
        if (!normalizedSource || !normalizedTarget) {
            continue;
        }

        normalized[normalizedSource] = normalizedTarget;
    }

    return normalized;
}

function normalizeExtensions(extensions: readonly string[] | undefined): readonly string[] {
    if (!extensions) {
        return DEFAULT_EXTENSIONS;
    }

    const normalized = extensions
        .map((extension) => normalizeExtensionToken(extension))
        .filter((extension) => extension.length > 0);

    return normalized.length > 0 ? [...new Set(normalized)] : DEFAULT_EXTENSIONS;
}

function normalizeFileNames(option: boolean | readonly string[] | string, defaults: string[]): string[] | undefined {
    if (typeof option === 'boolean') {
        return option ? defaults : undefined;
    }
    if (Array.isArray(option)) {
        return option.length > 0 ? [...(option as readonly string[])] : undefined;
    }
    return [option as string];
}

function buildReverseExtensionAliases(extensionAlias: Readonly<Record<string, string>>): ReverseExtensionAlias {
    const reverseAlias: Record<string, string[]> = {};
    const aliasEntries = Object.entries(extensionAlias);

    for (const [sourceExtension, targetExtension] of aliasEntries) {
        // already normalized
        const normalizedSource = sourceExtension;
        const normalizedTarget = targetExtension;

        reverseAlias[normalizedTarget] ??= [];

        if (!reverseAlias[normalizedTarget].includes(normalizedSource)) {
            reverseAlias[normalizedTarget].push(normalizedSource);
        }
    }

    for (const [key, aliases] of Object.entries(reverseAlias)) {
        aliases.push(key);
    }

    return reverseAlias;
}

function serializeManualAliases(configs: readonly ManualAliasEntry[]): string {
    return configs
        .map((entry) => {
            const serializedPaths = Object.keys(entry.paths)
                .sort()
                .map((alias) => `${alias}=${(entry.paths[alias] ?? []).join(',')}`)
                .join(';');
            return `${entry.baseUrl ?? ''}=>${serializedPaths}`;
        })
        .sort()
        .join('|');
}

function serializeExtensionAliases(extensionAlias: Readonly<Record<string, string>>): string {
    return Object.entries(extensionAlias)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .join('|');
}

function toResolveCacheKey(options: NormaizedResolveImportOptions): string {
    // do not sort arrays, order matters
    return [
        options.extensions.join(','),
        serializeExtensionAliases(options.extensionAlias),
        String(options.resolveCacheTtl),
        options.tsconfigNames?.join(',') ?? '',
        options.packageJsonNames?.join(',') ?? '',
        serializeManualAliases(options.manualAliases),
    ].join('\u0000');
}

export type ResolverLike = {
    clearCache: () => void;
    getAliasMappings: (filePath: string) => AbsolutePathAliasArray;
    getExtensionAliases: () => Readonly<Record<string, string>>;
    // resolved file normalized to posix separator
    resolve: (input: ResolveInput | ResolveInputDir) => null | ResolvedImport;
};

const FS_CACHE_TTL = 5_000;
const RESOLVE_CACHE_TTL = 10_000;
class ImportResolverImpl implements ResolverLike {
    private readonly options: NormaizedResolveImportOptions;
    private readonly extensionAlias: ReverseExtensionAlias;
    private readonly aliasParser: AliasParser;
    private static readonly resolverCache = new LRUCache<string, ImportResolverImpl>({ max: 100 });
    private static readonly fileSystem = createFsCache({ fs, ttl: FS_CACHE_TTL });
    private readonly resolveCache;

    public constructor(options: NormaizedResolveImportOptions) {
        this.options = options;
        this.extensionAlias = buildReverseExtensionAliases(options.extensionAlias);

        const absoluteManualAlias = buildAbsoluteAliasOptions(options.manualAliases);
        this.aliasParser = createAliasParser({
            fileSystem: ImportResolverImpl.fileSystem,
            packageJsonNames: options.packageJsonNames,
            tsconfigNames: options.tsconfigNames,
            errorLog: options.errorLog,
            absoluteManualAlias,
        });

        this.resolveCache = new LRUCache<string, { value: null | ResolvedImport }>({
            max: 5_000,
            ttl: options.resolveCacheTtl,
        });
    }

    public static createNew(options: ResolveImportOptions = {}): ImportResolverImpl {
        const normalizedOptions: NormaizedResolveImportOptions = {
            errorLog: options.errorLog ?? false,
            extensionAlias: normalizeExtensionAliases(options.extensionAlias),
            extensions: normalizeExtensions(options.extensions),
            manualAliases: normalizeManualAliases(options.manualAliases),
            tsconfigNames: normalizeFileNames(options.useTsConfig ?? true, ['tsconfig.json', 'jsconfig.json']),
            packageJsonNames: normalizeFileNames(options.usePackageJson ?? true, ['package.json']),
            resolveCacheTtl: options.resolveCacheTtl ?? RESOLVE_CACHE_TTL,
        };
        const key = toResolveCacheKey(normalizedOptions);
        let cached = ImportResolverImpl.resolverCache.get(key);
        if (cached) {
            return cached;
        }

        cached = new ImportResolverImpl(normalizedOptions);
        ImportResolverImpl.resolverCache.set(key, cached);

        return cached;
    }

    public getExtensionAliases(): Readonly<Record<string, string>> {
        return this.options.extensionAlias;
    }

    public resolve(input: ResolveInput | ResolveInputDir): null | ResolvedImport {
        const importerDir =
            'importerFile' in input
                ? path.dirname(normalizePath(input.importerFile))
                : normalizePath(input.importerDir);
        const normalizedInput = {
            importerDir,
            specifier: normalizePath(input.specifier),
        };
        const key = `${normalizedInput.importerDir}\u0000${normalizedInput.specifier}`;
        const cached = this.resolveCache.get(key);

        if (cached !== undefined) {
            return cached.value;
        }

        const resolved = this.resolveUncached(normalizedInput);
        this.resolveCache.set(key, { value: resolved });

        return resolved;
    }

    public getAliasMappings(filePath: string): AbsolutePathAliasArray {
        const fileDir = normalizePath(filePath);
        return this.aliasParser.getAliasMappings(fileDir);
    }

    public getNearestTsJsConfig(fileDir: string, skipNormalize?: boolean): AliasCacheEntry | null {
        if (!skipNormalize) fileDir = normalizePath(fileDir);
        return this.aliasParser.getNearestTsJsConfig(fileDir, skipNormalize);
    }

    public getNearestPackageJson(fileDir: string, skipNormalize?: boolean): AliasCacheEntry | null {
        if (!skipNormalize) fileDir = normalizePath(fileDir);
        return this.aliasParser.getNearestPackageJson(fileDir, skipNormalize);
    }

    public clearCache(): void {
        this.resolveCache.clear();
        this.aliasParser.clearCache();
    }

    public static clearCaches(): void {
        for (const resolver of ImportResolverImpl.resolverCache.values()) {
            resolver.clearCache();
        }
        ImportResolverImpl.resolverCache.clear();
        ImportResolverImpl.fileSystem.clearCache();
    }

    private resolveUncached(input: ResolveInputDir): null | ResolvedImport {
        const importerDir = input.importerDir;
        const specifier = input.specifier;

        if (!specifier || (!path.posix.isAbsolute(importerDir) && !path.win32.isAbsolute(importerDir))) {
            return null;
        }

        let resolvedFile: ResolvedPath | undefined;
        let specifierClass: SpecifierClassType | undefined;
        if (specifier.startsWith('.')) {
            resolvedFile = tryResolveTargetPath(
                ImportResolverImpl.fileSystem,
                normalizePath(path.join(importerDir, specifier)),
                this.options.extensions,
                this.extensionAlias
            );
            specifierClass = 'Relative';
        } else {
            const normalizedSpecifier = normalizePath(specifier);
            if (path.posix.isAbsolute(normalizedSpecifier) || path.win32.isAbsolute(normalizedSpecifier)) {
                resolvedFile = tryResolveTargetPath(
                    ImportResolverImpl.fileSystem,
                    normalizedSpecifier,
                    this.options.extensions,
                    this.extensionAlias
                );
                specifierClass = 'Absolute';
            } else {
                const resolvedAlias = resolveAliasTargetPath(
                    ImportResolverImpl.fileSystem,
                    specifier,
                    this.aliasParser.getAliasMappings(importerDir),
                    this.options.extensions,
                    this.extensionAlias
                );
                resolvedFile = resolvedAlias;
                specifierClass = resolvedAlias?.specifierClass;
            }
        }

        if (!resolvedFile || !specifierClass) return null;

        return {
            resolvedFile: resolvedFile.path,
            importerDir,
            specifierClass,
            specifierKind: resolvedFile.specifierKind,
        };
    }
}

type InterfaceOf<T> = Pick<T, keyof T>;
export type ImportResolver = InterfaceOf<ImportResolverImpl>;

export function createImportResolver(options: ResolveImportOptions = {}): ImportResolver {
    return ImportResolverImpl.createNew(options);
}

export function clearAllCaches() {
    ImportResolverImpl.clearCaches();
}
