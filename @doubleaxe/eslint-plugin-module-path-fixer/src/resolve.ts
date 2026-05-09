import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Resolver } from 'enhanced-resolve';
import enhancedResolve, { CachedInputFileSystem } from 'enhanced-resolve';
import { LRUCache } from 'lru-cache';
import type { ConfigLoaderSuccessResult } from 'tsconfig-paths';
import { loadConfig, matchFromAbsolutePaths } from 'tsconfig-paths';

import { normalizePath } from './normalizer.js';

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'] as const;
const DEFAULT_EXTENSION_ALIAS = {
    ts: 'js',
    tsx: 'jsx',
    mts: 'mjs',
    cts: 'cjs',
} as const;

export type TsJsConfigCacheEntry = {
    alias: AbsolutePathAliasArray;
    config: ConfigLoaderSuccessResult;
    path: string;
};

export type PackageJsonCacheEntry = {
    alias: AbsolutePathAliasArray;
    content: PackageJsonContent;
    path: string;
};

export type ResolvedImport = {
    resolvedFile: string;
};

export type ManualTsConfigEntry = {
    baseUrl: string;
    paths: Readonly<Record<string, readonly string[]>>;
};
export type AbsolutePathAliasArray = { alias: string[]; name: string }[];

export type ResolveInput = {
    importerFile: string;
    specifier: string;
};

export type ResolveInputDir = {
    importerDir: string;
    specifier: string;
};

export type ResolveImportOptions = {
    extensionAlias?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    usePackageJson?: boolean;
    useTsConfig?: boolean | string | string[];
};

type NormaizedResolveImportOptions = Required<ResolveImportOptions>;

export type PackageJsonContent = {
    [key: string]: unknown;
    imports?: Record<string, unknown>;
};

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

function isManualTsConfigEntry(value: unknown): value is ManualTsConfigEntry {
    return (
        isObject(value) &&
        typeof value['baseUrl'] === 'string' &&
        value['baseUrl'].length > 0 &&
        isObject(value['paths'])
    );
}

function normalizeManualTsConfigs(
    manualTsConfigs: readonly ManualTsConfigEntry[] | undefined
): readonly ManualTsConfigEntry[] {
    return (manualTsConfigs ?? [])
        .filter((entry) => isManualTsConfigEntry(entry))
        .map((entry) => ({
            baseUrl: entry.baseUrl,
            paths: normalizeManualPathsRecord(entry.paths),
        }))
        .filter((entry) => Object.keys(entry.paths).length > 0);
}

function normalizeResolvedAliasTarget(baseUrl: string, target: string): string {
    return normalizePath(path.isAbsolute(target) ? target : path.resolve(baseUrl, target));
}

function buildAbsoluteAliasOptions(manualTsConfigs: readonly ManualTsConfigEntry[]): AbsolutePathAliasArray {
    const aliasOptions: AbsolutePathAliasArray = [];

    for (const manualTsConfig of manualTsConfigs) {
        const baseUrl = path.isAbsolute(manualTsConfig.baseUrl)
            ? manualTsConfig.baseUrl
            : path.resolve(process.cwd(), manualTsConfig.baseUrl);
        for (const [alias, aliasPaths] of Object.entries(manualTsConfig.paths)) {
            const resolvedTargets = aliasPaths.map((aliasPath) => normalizeResolvedAliasTarget(baseUrl, aliasPath));
            aliasOptions.push({
                name: alias,
                alias: resolvedTargets,
            });
        }
    }

    return aliasOptions;
}

type ReverseExtensionAlias = Record<string, string[]>;

function normalizeExtensionToken(value: string): string {
    const withoutDot = value.startsWith('.') ? value.slice(1) : value;
    return withoutDot.trim();
}

function buildReverseExtensionAliases(extensionAlias: Readonly<Record<string, string>>): ReverseExtensionAlias {
    const reverseAlias: Record<string, string[]> = {};
    const aliasEntries = Object.entries(extensionAlias);

    for (const [sourceExtension, targetExtension] of aliasEntries) {
        const normalizedSource = normalizeExtensionToken(sourceExtension);
        const normalizedTarget = normalizeExtensionToken(targetExtension);
        if (!normalizedSource || !normalizedTarget) {
            continue;
        }

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

function collectImportTargets(value: unknown): string[] {
    if (typeof value === 'string') {
        return [value];
    }

    if (Array.isArray(value)) {
        return [...new Set(value.flatMap((entry) => collectImportTargets(entry)))];
    }

    if (value && typeof value === 'object') {
        return [
            ...new Set(Object.values(value as Record<string, unknown>).flatMap((entry) => collectImportTargets(entry))),
        ];
    }

    return [];
}

function normalizePackageImportTarget(value: string): string {
    return normalizePath(value).replace(/^\.\/+/, '');
}

function buildPackageImportAliases(packageJson: PackageJsonCacheEntry): ManualTsConfigEntry | null {
    const imports = packageJson.content.imports;
    if (!imports || typeof imports !== 'object') {
        return null;
    }

    const paths: Record<string, string[]> = {};
    for (const [specifier, targetConfig] of Object.entries(imports)) {
        if (!specifier.startsWith('#')) {
            continue;
        }

        const targets = collectImportTargets(targetConfig)
            .map(normalizePackageImportTarget)
            .filter((target) => target.length > 0);

        if (targets.length > 0) {
            paths[specifier] = [...new Set(targets)];
        }
    }

    if (Object.keys(paths).length === 0) {
        return null;
    }

    return {
        baseUrl: path.dirname(packageJson.path),
        paths,
    };
}

// tsconfig-paths mapping-entry.js
function sortByLongestPrefix(arr: AbsolutePathAliasArray): AbsolutePathAliasArray {
    return arr.sort((a, b) => getPrefixLength(b.name) - getPrefixLength(a.name));
}

function getPrefixLength(pattern: string): number {
    const prefixLength = pattern.indexOf('*');
    return pattern.substring(0, prefixLength).length;
}

function mergeAliasMappings(entries: AbsolutePathAliasArray): AbsolutePathAliasArray {
    const merged = new Map<string, string[]>();

    for (const entry of entries) {
        let paths = merged.get(entry.name);
        if (paths === undefined) {
            paths = [];
            merged.set(entry.name, paths);
        }
        for (const alias of entry.alias) {
            if (!paths.includes(alias)) {
                paths.push(alias);
            }
        }
    }

    return sortByLongestPrefix([...merged.entries()].map(([name, alias]) => ({ name, alias })));
}

function serializeManualTsConfigs(configs: readonly ManualTsConfigEntry[]): string {
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
    return [
        options.extensions.join(','),
        serializeExtensionAliases(options.extensionAlias),
        String(options.useTsConfig),
        String(options.usePackageJson),
        serializeManualTsConfigs(options.manualTsConfigs),
    ].join('\u0000');
}

export type ResolverLike = {
    clearCache: () => void;
    getAliasMappings: (filePath: string) => AbsolutePathAliasArray;
    resolve: (input: ResolveInput | ResolveInputDir) => null | ResolvedImport;
};

const RESOLVE_CACHE_TTL = 10_000;
const CONFIG_CACHE_TTL = 30_000;
class ImportResolverImpl implements ResolverLike {
    private readonly options: NormaizedResolveImportOptions;
    private enhancedResolver: Resolver | undefined;
    private readonly extensionAlias: ReverseExtensionAlias;
    private readonly absolutePathAlias: AbsolutePathAliasArray;
    private readonly resolveCache = new LRUCache<string, { value: null | ResolvedImport }>({
        max: 5_000,
        ttl: RESOLVE_CACHE_TTL,
    });
    private static readonly resolverCache = new LRUCache<string, ImportResolverImpl>({ max: 100 });
    // cannot be static, because uses options
    private readonly tsconfigCache = new LRUCache<string, { value: null | TsJsConfigCacheEntry }>({
        max: 5_000,
        ttl: CONFIG_CACHE_TTL,
    });
    private static readonly packageJsonCache = new LRUCache<string, { value: null | PackageJsonCacheEntry }>({
        max: 5_000,
        ttl: CONFIG_CACHE_TTL,
    });
    private static readonly fileSystem = new CachedInputFileSystem(fs, RESOLVE_CACHE_TTL);

    public constructor(options: NormaizedResolveImportOptions) {
        this.options = options;
        this.extensionAlias = buildReverseExtensionAliases(options.extensionAlias);
        this.absolutePathAlias = buildAbsoluteAliasOptions(options.manualTsConfigs);
    }

    public static createNew(options: ResolveImportOptions = {}): ImportResolverImpl {
        const normalizedOptions: NormaizedResolveImportOptions = {
            extensionAlias: options.extensionAlias ?? DEFAULT_EXTENSION_ALIAS,
            extensions: options.extensions ?? DEFAULT_EXTENSIONS,
            manualTsConfigs: normalizeManualTsConfigs(options.manualTsConfigs),
            useTsConfig: options.useTsConfig ?? true,
            usePackageJson: options.usePackageJson ?? true,
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

    public resolve(input: ResolveInput | ResolveInputDir): null | ResolvedImport {
        const importerDir =
            'importerFile' in input
                ? normalizePath(path.dirname(input.importerFile))
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
        return this.getAliasMappingsInternal(fileDir, true);
    }

    private getAliasMappingsInternal(fileDir: string, usePackageJson?: boolean): AbsolutePathAliasArray {
        const mappings: AbsolutePathAliasArray = [...this.absolutePathAlias];

        if (this.options.useTsConfig) {
            const nearestTsConfig = this.getNearestTsJsConfig(fileDir);
            if (nearestTsConfig) {
                mappings.push(...nearestTsConfig.alias);
            }
        }

        if (usePackageJson && this.options.usePackageJson) {
            const nearestPackageJson = this.getNearestPackageJson(fileDir);
            if (nearestPackageJson) {
                mappings.push(...nearestPackageJson.alias);
            }
        }

        return mergeAliasMappings(mappings);
    }

    public getNearestTsJsConfig(fileDir: string): null | TsJsConfigCacheEntry {
        const cached = this.tsconfigCache.get(fileDir);

        if (cached !== undefined) {
            return cached.value;
        }

        const nearest = this.findNearestTsJsConfig(fileDir);
        this.tsconfigCache.set(fileDir, { value: nearest });

        return nearest;
    }

    public getNearestPackageJson(fileDir: string): null | PackageJsonCacheEntry {
        const cached = ImportResolverImpl.packageJsonCache.get(fileDir);

        if (cached !== undefined) {
            return cached.value;
        }

        const nearest = this.findNearestPackageJson(fileDir);
        ImportResolverImpl.packageJsonCache.set(fileDir, { value: nearest });

        return nearest;
    }

    public clearCache(): void {
        this.resolveCache.clear();
        this.tsconfigCache.clear();
    }

    public static clearCaches(): void {
        ImportResolverImpl.resolverCache.clear();
        ImportResolverImpl.packageJsonCache.clear();
        ImportResolverImpl.fileSystem.purge();
    }

    private resolveUncached(input: ResolveInputDir): null | ResolvedImport {
        const importerDir = input.importerDir;
        const specifier = input.specifier;

        if (!specifier || !path.isAbsolute(importerDir)) {
            return null;
        }

        let resolvedFile = this.resolveWithTsconfigPaths(importerDir, specifier);
        if (resolvedFile) {
            return { resolvedFile };
        }

        resolvedFile = this.resolveWithEnhancedResolver(importerDir, specifier);
        if (resolvedFile) {
            return { resolvedFile };
        }

        return null;
    }

    private resolveWithTsconfigPaths(importerDir: string, specifier: string): string | undefined {
        // use tsconfig-paths to process manual aliases and tsconfigs
        // it is much more lightweight than enhanced resolve
        const aliasConfig = this.getAliasMappingsInternal(importerDir);
        if (!aliasConfig.length) return undefined;

        const absolutePathMappings = aliasConfig.map(
            (entry) =>
                ({
                    pattern: entry.name,
                    paths: entry.alias,
                }) as const
        );
        // do not try to read json
        const readJson = () => undefined;
        // strange, it doesn't return original path, just some stripped one
        let lastSuccessfullPath: string | undefined;
        const fileExists = (filePath: string) => {
            try {
                ImportResolverImpl.fileSystem.statSync(filePath).isFile();
                lastSuccessfullPath = filePath;
                return true;
            } catch {
                return false;
            }
        };
        const extensions = [...this.options.extensions];
        const extension = path.extname(specifier);
        const extensionWithoutDot = extension.startsWith('.') ? extension.slice(1) : extension;
        const extensionAlias = this.extensionAlias[extensionWithoutDot];
        if (extensionAlias) {
            const specifierWithoutExtension = specifier.slice(0, -extension.length);
            if (specifierWithoutExtension) {
                for (const alias of extensionAlias) {
                    const resolved = matchFromAbsolutePaths(
                        absolutePathMappings,
                        `${specifierWithoutExtension}.${alias}`,
                        readJson,
                        fileExists,
                        extensions
                    );
                    if (resolved) return lastSuccessfullPath;
                }
                return undefined;
            }
        }

        const resolved = matchFromAbsolutePaths(absolutePathMappings, specifier, readJson, fileExists, extensions);
        if (resolved) return lastSuccessfullPath;
        return undefined;
    }

    private resolveWithEnhancedResolver(importerDir: string, specifier: string): string | undefined {
        // use enhanced resolver only for absolute or package.json imports
        // it is very large
        let resolver = this.enhancedResolver;
        if (!resolver) {
            resolver = enhancedResolve.ResolverFactory.createResolver({
                alias: [],
                aliasFields: [],
                conditionNames: [],
                descriptionFiles: this.options.usePackageJson ? ['package.json'] : [],
                exportsFields: [],
                extensionAlias: this.extensionAlias,
                extensionAliasForExports: false,
                extensions: [...this.options.extensions],
                fallback: [],
                fileSystem: ImportResolverImpl.fileSystem,
                fullySpecified: false,
                importsFields: this.options.usePackageJson ? ['imports'] : [],
                mainFields: [],
                mainFiles: ['index'],
                modules: [],
                plugins: [],
                preferAbsolute: false,
                preferRelative: false,
                resolveToContext: false,
                restrictions: [],
                roots: [],
                symlinks: false,
                tsconfig: false,
                useSyncFileSystemCalls: true,
            });
            this.enhancedResolver = resolver;
        }
        try {
            const resolved = resolver.resolveSync(importerDir, specifier);
            return resolved ? normalizePath(resolved) : undefined;
        } catch {
            return undefined;
        }
    }

    private findNearestTsJsConfig(startDir: string): null | TsJsConfigCacheEntry {
        const arrayFromString = (s: string | string[]) => {
            return Array.isArray(s) ? s : [s];
        };
        const tsconfigName =
            typeof this.options.useTsConfig === 'boolean'
                ? ['tsconfig.json', 'jsconfig.json']
                : arrayFromString(this.options.useTsConfig);

        let currentDir = startDir;
        let visited: string[] = [];
        while (true) {
            const {
                currentDir: foundDir,
                foundCached,
                foundPath,
                visited: currentlyVisited,
            } = this.findNearestFile(currentDir, this.tsconfigCache, tsconfigName, visited);
            visited = currentlyVisited;

            if (foundCached) {
                return foundCached.value;
            }
            if (!foundPath) {
                return null;
            }

            try {
                const loaded = loadConfig(foundPath);

                if (loaded.resultType === 'success') {
                    const configPath = normalizePath(loaded.configFileAbsolutePath);
                    const entry: TsJsConfigCacheEntry = {
                        alias: buildAbsoluteAliasOptions([
                            {
                                baseUrl: loaded.absoluteBaseUrl,
                                paths: loaded.paths,
                            },
                        ]),
                        path: configPath,
                        config: loaded,
                    };

                    for (const dir of visited) {
                        this.tsconfigCache.set(dir, { value: entry });
                    }

                    return entry;
                }
            } catch {
                /**/
            }

            currentDir = path.dirname(foundDir);
            if (foundDir === currentDir) {
                for (const dir of visited) {
                    this.tsconfigCache.set(dir, { value: null });
                }
                return null;
            }
        }
    }

    private findNearestPackageJson(startDir: string): null | PackageJsonCacheEntry {
        let currentDir = startDir;
        let visited: string[] = [];

        while (true) {
            const {
                currentDir: foundDir,
                foundCached,
                foundPath,
                visited: currentlyVisited,
            } = this.findNearestFile(currentDir, ImportResolverImpl.packageJsonCache, ['package.json'], visited);
            visited = currentlyVisited;

            if (foundCached) {
                return foundCached.value;
            }
            if (!foundPath) {
                return null;
            }

            try {
                const raw = fs.readFileSync(foundPath, 'utf8');
                const content = JSON.parse(raw) as PackageJsonContent;
                const entry: PackageJsonCacheEntry = {
                    alias: [],
                    path: normalizePath(foundPath),
                    content,
                };
                const imports = buildPackageImportAliases(entry);
                if (imports) entry.alias = buildAbsoluteAliasOptions([imports]);

                for (const dir of visited) {
                    ImportResolverImpl.packageJsonCache.set(dir, { value: entry });
                }

                return entry;
            } catch {
                /**/
            }

            currentDir = path.dirname(foundDir);
            if (foundDir === currentDir) {
                for (const dir of visited) {
                    ImportResolverImpl.packageJsonCache.set(dir, { value: null });
                }
                return null;
            }
        }
    }

    private findNearestFile<T>(
        startDir: string,
        cache: LRUCache<string, { value: null | T }>,
        fileNames: string[],
        visited: string[]
    ): { currentDir: string; foundCached?: { value: null | T }; foundPath?: string; visited: string[] } {
        let currentDir = startDir;
        const fileExists = (filePath: string) => {
            try {
                ImportResolverImpl.fileSystem.statSync(filePath).isFile();
                return true;
            } catch {
                return false;
            }
        };

        while (true) {
            const memoized = cache.get(currentDir);
            if (memoized !== undefined) {
                for (const dir of visited) {
                    cache.set(dir, memoized);
                }
                return { currentDir, visited: [], foundCached: memoized };
            }

            visited.push(currentDir);

            for (const fileName of fileNames) {
                const filePath = path.join(currentDir, fileName);
                if (fileExists(filePath)) {
                    return { currentDir, visited, foundPath: filePath };
                }
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                for (const dir of visited) {
                    cache.set(dir, { value: null });
                }
                return { currentDir, visited: [] };
            }

            currentDir = parentDir;
        }
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
