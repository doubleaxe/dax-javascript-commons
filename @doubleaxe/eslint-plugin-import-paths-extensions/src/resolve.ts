import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

export type ManualTsConfigAlias = {
    alias: string;
    paths: readonly string[];
};

export type ResolveImportOptions = {
    caseInsensitive?: boolean;
    extensions?: readonly string[];
    importerFile: string;
    manualTsConfigAliases?: readonly ManualTsConfigAlias[];
    manualTsConfigBaseUrl?: string;
    specifier: string;
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

export type ImportResolverOptions = {
    caseInsensitive?: boolean;
    manualTsConfigAliases?: readonly ManualTsConfigAlias[];
    manualTsConfigBaseUrl?: string;
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
    manualTsConfigAliases: readonly ManualTsConfigAlias[];
    manualTsConfigBaseUrl?: string;
    specifier: string;
    usePackageJson: boolean;
    useTsConfig: boolean;
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

function normalizeManualAliases(aliases: readonly ManualTsConfigAlias[] | undefined): readonly ManualTsConfigAlias[] {
    if (!aliases || aliases.length === 0) {
        return [];
    }

    return aliases
        .filter((entry) => entry.alias.length > 0 && entry.paths.length > 0)
        .map((entry) => ({
            alias: entry.alias,
            paths: [...entry.paths],
        }));
}

function serializeManualAliases(aliases: readonly ManualTsConfigAlias[]): string {
    return aliases
        .map((entry) => `${entry.alias}=${entry.paths.join(',')}`)
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
        options.manualTsConfigBaseUrl ?? '',
        serializeManualAliases(options.manualTsConfigAliases),
    ].join('\u0000');
}

export class ImportResolver {
    private readonly options: ImportResolverOptions;
    private readonly resolveCache = new Map<string, null | ResolvedImport>();
    private readonly tsJsNearestCache = new Map<string, null | TsJsConfigCacheEntry>();
    private readonly packageNearestCache = new Map<string, null | PackageJsonCacheEntry>();
    private readonly manualAliasMatchPathCache = new Map<string, MatchPath>();

    public constructor(options: ImportResolverOptions = {}) {
        this.options = options;
    }

    public resolve(options: ResolveImportOptions): null | ResolvedImport {
        const effectiveOptions = this.toEffectiveResolveOptions(options);
        const key = toResolveCacheKey(effectiveOptions);
        const cached = this.resolveCache.get(key);

        if (cached !== undefined) {
            return cached;
        }

        const resolved = this.resolveUncached(effectiveOptions);
        this.resolveCache.set(key, resolved);

        return resolved;
    }

    public getNearestTsJsConfig(filePath: string): null | TsJsConfigCacheEntry {
        const startDir = toNearestCacheKey(filePath);
        const cached = this.tsJsNearestCache.get(startDir);

        if (cached !== undefined) {
            return cached;
        }

        const nearest = this.findNearestTsJsConfig(startDir);
        this.tsJsNearestCache.set(startDir, nearest);

        return nearest;
    }

    public getNearestPackageJson(filePath: string): null | PackageJsonCacheEntry {
        const startDir = toNearestCacheKey(filePath);
        const cached = this.packageNearestCache.get(startDir);

        if (cached !== undefined) {
            return cached;
        }

        const nearest = this.findNearestPackageJson(startDir);
        this.packageNearestCache.set(startDir, nearest);

        return nearest;
    }

    public clearCaches(): void {
        this.resolveCache.clear();
        this.tsJsNearestCache.clear();
        this.packageNearestCache.clear();
        this.manualAliasMatchPathCache.clear();
    }

    private toEffectiveResolveOptions(options: ResolveImportOptions): EffectiveResolveOptions {
        return {
            importerFile: normalizePath(options.importerFile),
            specifier: options.specifier,
            extensions: options.extensions ?? DEFAULT_EXTENSIONS,
            caseInsensitive: options.caseInsensitive ?? this.options.caseInsensitive ?? getDefaultCaseInsensitive(),
            useTsConfig: options.useTsConfig ?? this.options.useTsConfig ?? true,
            usePackageJson: options.usePackageJson ?? this.options.usePackageJson ?? true,
            manualTsConfigAliases: normalizeManualAliases(
                options.manualTsConfigAliases ?? this.options.manualTsConfigAliases
            ),
            manualTsConfigBaseUrl: options.manualTsConfigBaseUrl ?? this.options.manualTsConfigBaseUrl,
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

        if (options.useTsConfig) {
            const tsconfigResolved = this.tryResolveWithTsconfigPaths(
                importerFile,
                specifier,
                extensions,
                caseInsensitive,
                options.manualTsConfigAliases,
                options.manualTsConfigBaseUrl
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
        manualAliases: readonly ManualTsConfigAlias[],
        manualBaseUrl: string | undefined
    ): { resolvedFile: string; tsJsConfig?: TsJsConfigCacheEntry } | null {
        const nearestConfig = this.getNearestTsJsConfig(importerFile);

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

        if (manualAliases.length === 0) {
            return null;
        }

        const manualMatchPath = this.getManualAliasMatchPath(
            this.getManualTsConfigBaseUrl(importerFile, nearestConfig, manualBaseUrl),
            manualAliases
        );

        const manualResolved = this.tryResolveWithTsconfigMatchPath(
            manualMatchPath,
            specifier,
            extensions,
            caseInsensitive
        );
        if (!manualResolved) {
            return null;
        }

        return {
            resolvedFile: manualResolved,
            tsJsConfig: nearestConfig ?? undefined,
        };
    }

    private getManualTsConfigBaseUrl(
        importerFile: string,
        nearestConfig: null | TsJsConfigCacheEntry,
        manualBaseUrl: string | undefined
    ): string {
        if (manualBaseUrl) {
            return path.isAbsolute(manualBaseUrl)
                ? normalizePath(manualBaseUrl)
                : normalizePath(path.resolve(process.cwd(), manualBaseUrl));
        }

        if (nearestConfig && isTsConfigSuccess(nearestConfig.config)) {
            return normalizePath(nearestConfig.config.absoluteBaseUrl);
        }

        const nearestPackageJson = this.getNearestPackageJson(importerFile);
        if (nearestPackageJson) {
            return normalizePath(path.dirname(nearestPackageJson.path));
        }

        return normalizePath(path.dirname(importerFile));
    }

    private getManualAliasMatchPath(baseUrl: string, aliases: readonly ManualTsConfigAlias[]): MatchPath {
        const cacheKey = `${baseUrl}\u0000${serializeManualAliases(aliases)}`;
        const cached = this.manualAliasMatchPathCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const paths: Record<string, string[]> = {};
        for (const aliasEntry of aliases) {
            paths[aliasEntry.alias] = [...aliasEntry.paths];
        }

        const matchPath = createMatchPath(baseUrl, paths);
        this.manualAliasMatchPathCache.set(cacheKey, matchPath);

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
            const memoized = this.tsJsNearestCache.get(currentDir);
            if (memoized !== undefined) {
                for (const dir of visited) {
                    this.tsJsNearestCache.set(dir, memoized);
                }

                return memoized;
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
                    this.tsJsNearestCache.set(dir, entry);
                }

                return entry;
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                for (const dir of visited) {
                    this.tsJsNearestCache.set(dir, null);
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
            const memoized = this.packageNearestCache.get(currentDir);
            if (memoized !== undefined) {
                for (const dir of visited) {
                    this.packageNearestCache.set(dir, memoized);
                }

                return memoized;
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
                        this.packageNearestCache.set(dir, entry);
                    }

                    return entry;
                }
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                for (const dir of visited) {
                    this.packageNearestCache.set(dir, null);
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
