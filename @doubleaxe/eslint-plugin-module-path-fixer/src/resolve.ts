import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { LRUCache } from 'lru-cache';
import type { ConfigLoaderResult, ConfigLoaderSuccessResult, MatchPath } from 'tsconfig-paths';
import { createMatchPath, loadConfig } from 'tsconfig-paths';

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'] as const;
const TS_OR_JS_CONFIG_NAMES = ['tsconfig.json', 'jsconfig.json'] as const;
const PACKAGE_JSON_NAME = 'package.json';

export type ResolveStrategy = 'package-imports' | 'relative' | 'tsconfig-paths';

export type TsJsConfigCacheEntry = {
    config: ConfigLoaderResult;
    matchPath?: MatchPath;
    path: string;
    raw: string;
};

export type PackageJsonCacheEntry = {
    content: PackageJsonContent;
    path: string;
    raw: string;
};

export type ResolvedImport = {
    importerFile: string;
    packageJson?: PackageJsonCacheEntry;
    resolvedFile: string;
    specifier: string;
    strategy: ResolveStrategy;
    tsJsConfig?: TsJsConfigCacheEntry;
};

export type ManualTsConfigEntry = {
    baseUrl: string;
    paths: Readonly<Record<string, readonly string[]>>;
};

export type ResolveImportOptions = {
    caseInsensitive?: boolean;
    extensions?: readonly string[];
    importerFile: string;
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    specifier: string;
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

export type ImportResolverOptions = {
    caseInsensitive?: boolean;
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

export type PackageJsonContent = {
    [key: string]: unknown;
    imports?: Record<string, unknown>;
};

type EffectiveResolveOptions = {
    caseInsensitive: boolean;
    extensions: readonly string[];
    importerFile: string;
    manualTsConfigs: readonly NormalizedManualTsConfigEntry[];
    specifier: string;
    usePackageJson: boolean;
    useTsConfig: boolean;
};

type NormalizedManualTsConfigEntry = {
    baseUrl: string;
    paths: Readonly<Record<string, readonly string[]>>;
};

function normalizePath(filePath: string): string {
    return path.normalize(filePath);
}

function getDefaultCaseInsensitive(): boolean {
    return process.platform === 'win32' || process.platform === 'darwin';
}

function tryReadFile(filePath: string): string | undefined {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return undefined;
    }
}

function tryReadJson<T>(filePath: string): T | undefined {
    const raw = tryReadFile(filePath);
    if (raw === undefined) {
        return undefined;
    }

    try {
        return JSON.parse(raw) as T;
    } catch {
        return undefined;
    }
}

function isFile(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

function resolvePathCaseInsensitive(targetPath: string): string | undefined {
    const normalizedTarget = normalizePath(targetPath);
    const absoluteTarget = path.isAbsolute(normalizedTarget)
        ? normalizedTarget
        : normalizePath(path.resolve(process.cwd(), normalizedTarget));
    const parsed = path.parse(absoluteTarget);

    let currentPath = parsed.root;
    const remaining = absoluteTarget.slice(parsed.root.length);
    const segments = remaining.length === 0 ? [] : remaining.split(path.sep).filter(Boolean);

    for (const segment of segments) {
        const exactPath = path.join(currentPath, segment);
        if (fs.existsSync(exactPath)) {
            currentPath = exactPath;
            continue;
        }

        let entries: string[];
        try {
            entries = fs.readdirSync(currentPath);
        } catch {
            return undefined;
        }

        const matched = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
        if (!matched) {
            return undefined;
        }

        currentPath = path.join(currentPath, matched);
    }

    return normalizePath(currentPath);
}

function resolveFile(filePath: string, caseInsensitive: boolean): string | undefined {
    const normalizedPath = normalizePath(filePath);

    if (isFile(normalizedPath)) {
        return normalizedPath;
    }

    if (!caseInsensitive) {
        return undefined;
    }

    const matchedPath = resolvePathCaseInsensitive(normalizedPath);
    if (!matchedPath || !isFile(matchedPath)) {
        return undefined;
    }

    return matchedPath;
}

function resolveAsFileOrDirectory(
    candidatePath: string,
    extensions: readonly string[],
    caseInsensitive: boolean
): string | undefined {
    const normalizedCandidate = normalizePath(candidatePath);

    const fileMatch = resolveFile(normalizedCandidate, caseInsensitive);
    if (fileMatch) {
        return fileMatch;
    }

    for (const ext of extensions) {
        const fileWithExt = `${normalizedCandidate}${ext}`;
        const fileWithExtMatch = resolveFile(fileWithExt, caseInsensitive);
        if (fileWithExtMatch) {
            return fileWithExtMatch;
        }
    }

    for (const ext of extensions) {
        const indexWithExt = path.join(normalizedCandidate, `index${ext}`);
        const indexMatch = resolveFile(indexWithExt, caseInsensitive);
        if (indexMatch) {
            return indexMatch;
        }
    }

    return undefined;
}

function toNearestCacheKey(filePath: string): string {
    return normalizePath(path.dirname(filePath));
}

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
): readonly NormalizedManualTsConfigEntry[] {
    return (manualTsConfigs ?? [])
        .filter((entry) => isManualTsConfigEntry(entry))
        .map((entry) => ({
            baseUrl: entry.baseUrl,
            paths: normalizeManualPathsRecord(entry.paths),
        }))
        .filter((entry) => Object.keys(entry.paths).length > 0);
}

function serializeManualTsConfigs(configs: readonly NormalizedManualTsConfigEntry[]): string {
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

function toResolveCacheKey(options: EffectiveResolveOptions): string {
    return [
        normalizePath(options.importerFile),
        options.specifier,
        options.extensions.join(','),
        options.caseInsensitive ? 'ci:1' : 'ci:0',
        options.useTsConfig ? 'ts:1' : 'ts:0',
        options.usePackageJson ? 'pkg:1' : 'pkg:0',
        serializeManualTsConfigs(options.manualTsConfigs),
    ].join('\u0000');
}

export class ImportResolver {
    private readonly options: ImportResolverOptions;
    private static readonly resolveCache = new LRUCache<string, { value: null | ResolvedImport }>({ max: 10_000 });
    private static readonly tsJsNearestCache = new LRUCache<string, { value: null | TsJsConfigCacheEntry }>({
        max: 5_000,
    });
    private static readonly packageNearestCache = new LRUCache<string, { value: null | PackageJsonCacheEntry }>({
        max: 5_000,
    });
    private static readonly manualAliasMatchPathCache = new LRUCache<string, MatchPath>({ max: 2_500 });

    public constructor(options: ImportResolverOptions = {}) {
        this.options = options;
    }

    public resolve(options: ResolveImportOptions): null | ResolvedImport {
        const effectiveOptions = this.toEffectiveResolveOptions(options);
        const key = toResolveCacheKey(effectiveOptions);
        const cached = ImportResolver.resolveCache.get(key);

        if (cached !== undefined) {
            return cached.value;
        }

        const resolved = this.resolveUncached(effectiveOptions);
        ImportResolver.resolveCache.set(key, { value: resolved });

        return resolved;
    }

    public getNearestTsJsConfig(filePath: string): null | TsJsConfigCacheEntry {
        const startDir = toNearestCacheKey(filePath);
        const cached = ImportResolver.tsJsNearestCache.get(startDir);

        if (cached !== undefined) {
            return cached.value;
        }

        const nearest = this.findNearestTsJsConfig(startDir);
        ImportResolver.tsJsNearestCache.set(startDir, { value: nearest });

        return nearest;
    }

    public getNearestPackageJson(filePath: string): null | PackageJsonCacheEntry {
        const startDir = toNearestCacheKey(filePath);
        const cached = ImportResolver.packageNearestCache.get(startDir);

        if (cached !== undefined) {
            return cached.value;
        }

        const nearest = this.findNearestPackageJson(startDir);
        ImportResolver.packageNearestCache.set(startDir, { value: nearest });

        return nearest;
    }

    public clearCaches(): void {
        ImportResolver.resolveCache.clear();
        ImportResolver.tsJsNearestCache.clear();
        ImportResolver.packageNearestCache.clear();
        ImportResolver.manualAliasMatchPathCache.clear();
    }

    private toEffectiveResolveOptions(options: ResolveImportOptions): EffectiveResolveOptions {
        return {
            importerFile: normalizePath(options.importerFile),
            specifier: options.specifier,
            extensions: options.extensions ?? DEFAULT_EXTENSIONS,
            caseInsensitive: options.caseInsensitive ?? this.options.caseInsensitive ?? getDefaultCaseInsensitive(),
            useTsConfig: options.useTsConfig ?? this.options.useTsConfig ?? true,
            usePackageJson: options.usePackageJson ?? this.options.usePackageJson ?? true,
            manualTsConfigs: normalizeManualTsConfigs(options.manualTsConfigs ?? this.options.manualTsConfigs),
        };
    }

    private resolveUncached(options: EffectiveResolveOptions): null | ResolvedImport {
        const importerFile = options.importerFile;
        const specifier = options.specifier;
        const extensions = options.extensions;
        const caseInsensitive = options.caseInsensitive;

        if (!specifier || !path.isAbsolute(importerFile)) {
            return null;
        }

        const relativeResolved = this.tryResolveRelative(importerFile, specifier, extensions, caseInsensitive);
        if (relativeResolved) {
            return {
                importerFile,
                specifier,
                strategy: 'relative',
                resolvedFile: relativeResolved,
                tsJsConfig: options.useTsConfig ? (this.getNearestTsJsConfig(importerFile) ?? undefined) : undefined,
                packageJson: options.usePackageJson
                    ? (this.getNearestPackageJson(importerFile) ?? undefined)
                    : undefined,
            };
        }

        if (options.useTsConfig || options.manualTsConfigs.length > 0) {
            const tsconfigResolved = this.tryResolveWithTsconfigPaths(
                importerFile,
                specifier,
                extensions,
                caseInsensitive,
                options.useTsConfig,
                options.manualTsConfigs
            );
            if (tsconfigResolved) {
                return {
                    importerFile,
                    specifier,
                    strategy: 'tsconfig-paths',
                    resolvedFile: tsconfigResolved.resolvedFile,
                    tsJsConfig: tsconfigResolved.tsJsConfig,
                    packageJson: options.usePackageJson
                        ? (this.getNearestPackageJson(importerFile) ?? undefined)
                        : undefined,
                };
            }
        }

        if (options.usePackageJson) {
            const packageImportsResolved = this.tryResolveWithPackageImports(
                importerFile,
                specifier,
                extensions,
                caseInsensitive
            );
            if (packageImportsResolved) {
                return {
                    importerFile,
                    specifier,
                    strategy: 'package-imports',
                    resolvedFile: packageImportsResolved.resolvedFile,
                    packageJson: packageImportsResolved.packageJson,
                    tsJsConfig: options.useTsConfig
                        ? (this.getNearestTsJsConfig(importerFile) ?? undefined)
                        : undefined,
                };
            }
        }

        return null;
    }

    private tryResolveRelative(
        importerFile: string,
        specifier: string,
        extensions: readonly string[],
        caseInsensitive: boolean
    ): string | undefined {
        if (!specifier.startsWith('.')) {
            return undefined;
        }

        const importerDir = path.dirname(importerFile);
        const candidate = path.resolve(importerDir, specifier);

        return resolveAsFileOrDirectory(candidate, extensions, caseInsensitive);
    }

    private tryResolveWithTsconfigMatchPath(
        matchPath: MatchPath,
        specifier: string,
        extensions: readonly string[],
        caseInsensitive: boolean
    ): string | undefined {
        const mapped = matchPath(specifier, undefined, undefined, extensions);
        if (!mapped) {
            return undefined;
        }

        return resolveAsFileOrDirectory(mapped, extensions, caseInsensitive);
    }

    private tryResolveWithTsconfigPaths(
        importerFile: string,
        specifier: string,
        extensions: readonly string[],
        caseInsensitive: boolean,
        useTsConfig: boolean,
        manualTsConfigs: readonly NormalizedManualTsConfigEntry[]
    ): { resolvedFile: string; tsJsConfig?: TsJsConfigCacheEntry } | null {
        const nearestConfig = useTsConfig ? this.getNearestTsJsConfig(importerFile) : null;

        if (nearestConfig?.matchPath) {
            const tsconfigResolved = this.tryResolveWithTsconfigMatchPath(
                nearestConfig.matchPath,
                specifier,
                extensions,
                caseInsensitive
            );
            if (tsconfigResolved) {
                return { resolvedFile: tsconfigResolved, tsJsConfig: nearestConfig };
            }
        }

        if (manualTsConfigs.length === 0) {
            return null;
        }

        for (const manualTsConfig of manualTsConfigs) {
            const manualMatchPath = this.getManualAliasMatchPath(
                this.getManualTsConfigBaseUrl(manualTsConfig.baseUrl),
                manualTsConfig.paths
            );

            const manualResolved = this.tryResolveWithTsconfigMatchPath(
                manualMatchPath,
                specifier,
                extensions,
                caseInsensitive
            );
            if (!manualResolved) {
                continue;
            }

            return {
                resolvedFile: manualResolved,
                tsJsConfig: nearestConfig ?? undefined,
            };
        }

        return null;
    }

    private getManualTsConfigBaseUrl(manualBaseUrl: string): string {
        return path.isAbsolute(manualBaseUrl)
            ? normalizePath(manualBaseUrl)
            : normalizePath(path.resolve(process.cwd(), manualBaseUrl));
    }

    private getManualAliasMatchPath(baseUrl: string, paths: Readonly<Record<string, readonly string[]>>): MatchPath {
        const cacheKey = serializeManualTsConfigs([{ baseUrl, paths }]);
        const cached = ImportResolver.manualAliasMatchPathCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const tsconfigPaths: Record<string, string[]> = {};
        for (const [alias, aliasPaths] of Object.entries(paths)) {
            tsconfigPaths[alias] = [...aliasPaths];
        }

        const matchPath = createMatchPath(baseUrl, tsconfigPaths);
        ImportResolver.manualAliasMatchPathCache.set(cacheKey, matchPath);

        return matchPath;
    }

    private tryResolveWithPackageImports(
        importerFile: string,
        specifier: string,
        extensions: readonly string[],
        caseInsensitive: boolean
    ): { packageJson: PackageJsonCacheEntry; resolvedFile: string } | null {
        if (!specifier.startsWith('#')) {
            return null;
        }

        const nearestPackageJson = this.getNearestPackageJson(importerFile);
        if (!nearestPackageJson?.content.imports || Object.keys(nearestPackageJson.content.imports).length === 0) {
            return null;
        }

        const resolved = this.resolveWithNode(importerFile, specifier);
        if (!resolved) {
            return null;
        }

        const resolvedFile = resolveAsFileOrDirectory(resolved, extensions, caseInsensitive);
        if (!resolvedFile) {
            return null;
        }

        return { resolvedFile, packageJson: nearestPackageJson };
    }

    private resolveWithNode(importerFile: string, specifier: string): string | undefined {
        const importerUrl = pathToFileURL(importerFile).href;

        try {
            const importMetaResolve = (
                import.meta as {
                    resolve?: (moduleSpecifier: string, parentUrl?: string) => string;
                } & ImportMeta
            ).resolve;

            if (typeof importMetaResolve === 'function') {
                const resolvedUrl = importMetaResolve(specifier, importerUrl);
                if (resolvedUrl.startsWith('file://')) {
                    return normalizePath(fileURLToPath(resolvedUrl));
                }

                return undefined;
            }
        } catch {
            // Fall through to require.resolve based fallback.
        }

        try {
            const nodeRequire = createRequire(importerFile);
            const resolvedPath = nodeRequire.resolve(specifier);
            return normalizePath(resolvedPath);
        } catch {
            return undefined;
        }
    }

    private findNearestTsJsConfig(startDir: string): null | TsJsConfigCacheEntry {
        const visited: string[] = [];
        let currentDir = startDir;

        while (true) {
            const memoized = ImportResolver.tsJsNearestCache.get(currentDir);
            if (memoized !== undefined) {
                for (const dir of visited) {
                    ImportResolver.tsJsNearestCache.set(dir, memoized);
                }

                return memoized.value;
            }

            visited.push(currentDir);

            for (const fileName of TS_OR_JS_CONFIG_NAMES) {
                const configPath = path.join(currentDir, fileName);
                if (!isFile(configPath)) {
                    continue;
                }

                const raw = tryReadFile(configPath);
                if (raw === undefined) {
                    continue;
                }

                const loaded = loadConfig(currentDir);
                if (loaded.resultType !== 'success') {
                    continue;
                }

                const loadedConfigPath = normalizePath(loaded.configFileAbsolutePath);
                if (loadedConfigPath !== normalizePath(configPath)) {
                    continue;
                }

                const matchPath = createMatchPath(
                    loaded.absoluteBaseUrl,
                    loaded.paths,
                    loaded.mainFields,
                    loaded.addMatchAll
                );

                const entry: TsJsConfigCacheEntry = {
                    path: normalizePath(configPath),
                    raw,
                    config: loaded,
                    matchPath,
                };

                for (const dir of visited) {
                    ImportResolver.tsJsNearestCache.set(dir, { value: entry });
                }

                return entry;
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                for (const dir of visited) {
                    ImportResolver.tsJsNearestCache.set(dir, { value: null });
                }

                return null;
            }

            currentDir = parentDir;
        }
    }

    private findNearestPackageJson(startDir: string): null | PackageJsonCacheEntry {
        const visited: string[] = [];
        let currentDir = startDir;

        while (true) {
            const memoized = ImportResolver.packageNearestCache.get(currentDir);
            if (memoized !== undefined) {
                for (const dir of visited) {
                    ImportResolver.packageNearestCache.set(dir, memoized);
                }

                return memoized.value;
            }

            visited.push(currentDir);

            const packageJsonPath = path.join(currentDir, PACKAGE_JSON_NAME);
            if (isFile(packageJsonPath)) {
                const raw = tryReadFile(packageJsonPath);
                const content = tryReadJson<PackageJsonContent>(packageJsonPath);

                if (raw !== undefined && content !== undefined) {
                    const entry: PackageJsonCacheEntry = {
                        path: normalizePath(packageJsonPath),
                        raw,
                        content,
                    };

                    for (const dir of visited) {
                        ImportResolver.packageNearestCache.set(dir, { value: entry });
                    }

                    return entry;
                }
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                for (const dir of visited) {
                    ImportResolver.packageNearestCache.set(dir, { value: null });
                }

                return null;
            }

            currentDir = parentDir;
        }
    }
}

export function createImportResolver(options: ImportResolverOptions = {}): ImportResolver {
    return new ImportResolver(options);
}

export function isSupportedSpecifier(specifier: string): boolean {
    return specifier.startsWith('.') || specifier.startsWith('#');
}

export function getParentTraversalDepth(specifier: string): number {
    if (!specifier.startsWith('.')) {
        return 0;
    }

    const segments = specifier.split('/');
    let depth = 0;

    for (const segment of segments) {
        if (segment === '..') {
            depth += 1;
        }
    }

    return depth;
}

export function getResolvedExtension(resolvedFile: string): string {
    return path.extname(resolvedFile);
}

export function hasExplicitExtension(specifier: string): boolean {
    const extension = path.extname(specifier);
    return extension.length > 0;
}

export function removeExplicitExtension(specifier: string): string {
    const extension = path.extname(specifier);
    if (!extension) {
        return specifier;
    }

    return specifier.slice(0, -extension.length);
}

export function addExtension(specifier: string, extension: string): string {
    if (!extension.startsWith('.')) {
        return `${specifier}.${extension}`;
    }

    return `${specifier}${extension}`;
}

export function isTsConfigSuccess(config: ConfigLoaderResult): config is ConfigLoaderSuccessResult {
    return config.resultType === 'success';
}
