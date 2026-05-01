import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { LRUCache } from 'lru-cache';
import type { ConfigLoaderResult, ConfigLoaderSuccessResult, MatchPath } from 'tsconfig-paths';
import { createMatchPath, loadConfig } from 'tsconfig-paths';

import { normalizePath } from './normalizer.js';

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'] as const;
const DEFAULT_EXTENSION_ALIAS = {
    ts: 'js',
    tsx: 'jsx',
    mts: 'mjs',
    cts: 'cjs',
} as const;
const PACKAGE_JSON_NAME = 'package.json';

export type ResolveStrategy = 'package-imports' | 'relative' | 'tsconfig-paths';

export type TsJsConfigCacheEntry = {
    config: ConfigLoaderResult;
    matchPath?: MatchPath;
    path: string;
};

export type PackageJsonCacheEntry = {
    content: PackageJsonContent;
    path: string;
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

export type ResolveInput = {
    importerFile: string;
    specifier: string;
};

export type ResolveImportOptions = {
    extensionAlias?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    manualTsConfigs?: readonly ManualTsConfigEntry[];
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

type NormaizedResolveImportOptions = {
    extensionAlias: Readonly<Record<string, readonly string[]>>;
} & Omit<Required<ResolveImportOptions>, 'extensionAlias'>;

export type PackageJsonContent = {
    [key: string]: unknown;
    imports?: Record<string, unknown>;
};

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

function resolveFile(filePath: string): string | undefined {
    const normalizedPath = normalizePath(filePath);

    if (isFile(normalizedPath)) {
        return normalizedPath;
    }

    return undefined;
}

function resolveAsFileOrDirectory(
    candidatePath: string,
    extensions: readonly string[],
    extensionAlias: Readonly<Record<string, readonly string[]>>
): string | undefined {
    const normalizedCandidate = normalizePath(candidatePath);

    const fileMatch = resolveFile(normalizedCandidate);
    if (fileMatch) {
        return fileMatch;
    }

    const explicitExtension = normalizeExtensionToken(path.extname(normalizedCandidate));
    if (explicitExtension.length > 0) {
        const aliasExtensions = extensionAlias[explicitExtension] ?? [];
        const extensionlessCandidate = normalizedCandidate.slice(0, -path.extname(normalizedCandidate).length);

        for (const aliasExtension of aliasExtensions) {
            const aliasedFile = resolveFile(`${extensionlessCandidate}.${aliasExtension}`);
            if (aliasedFile) {
                return aliasedFile;
            }
        }
    }

    for (const ext of extensions) {
        const fileWithExt = `${normalizedCandidate}${ext}`;
        const fileWithExtMatch = resolveFile(fileWithExt);
        if (fileWithExtMatch) {
            return fileWithExtMatch;
        }
    }

    for (const ext of extensions) {
        const indexWithExt = path.join(normalizedCandidate, `index${ext}`);
        const indexMatch = resolveFile(indexWithExt);
        if (indexMatch) {
            return indexMatch;
        }
    }

    return undefined;
}

function normalizeExtensionToken(value: string): string {
    const withoutDot = value.startsWith('.') ? value.slice(1) : value;
    return withoutDot.trim().toLowerCase();
}

function normalizeExtensionAliases(
    extensionAlias: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, readonly string[]>> {
    const reverseAlias: Record<string, string[]> = {};
    const aliasEntries = Object.entries({
        ...DEFAULT_EXTENSION_ALIAS,
        ...(extensionAlias ?? {}),
    });

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

    for (const aliases of Object.values(reverseAlias)) {
        aliases.sort();
    }

    return reverseAlias;
}

function hasAliasedExplicitExtension(
    specifier: string,
    extensionAlias: Readonly<Record<string, readonly string[]>>
): boolean {
    const explicitExtension = normalizeExtensionToken(path.extname(specifier));
    return explicitExtension.length > 0 && (extensionAlias[explicitExtension]?.length ?? 0) > 0;
}

function hasCompatibleResolvedExtension(
    specifier: string,
    resolvedFile: string,
    extensionAlias: Readonly<Record<string, readonly string[]>>
): boolean {
    const explicitExtension = normalizeExtensionToken(path.extname(specifier));
    if (!explicitExtension) {
        return true;
    }

    const resolvedExtension = normalizeExtensionToken(path.extname(resolvedFile));
    if (!resolvedExtension) {
        return false;
    }

    if (resolvedExtension === explicitExtension) {
        return true;
    }

    return (extensionAlias[resolvedExtension] ?? []).includes(explicitExtension);
}

function getAliasedTargetExtension(
    specifier: string,
    extensionAlias: Readonly<Record<string, readonly string[]>>
): string | undefined {
    const explicitExtension = normalizeExtensionToken(path.extname(specifier));
    if (!explicitExtension) {
        return undefined;
    }

    for (const [targetExtension, sourceExtensions] of Object.entries(extensionAlias)) {
        if (sourceExtensions.includes(explicitExtension)) {
            return targetExtension;
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
): readonly ManualTsConfigEntry[] {
    return (manualTsConfigs ?? [])
        .filter((entry) => isManualTsConfigEntry(entry))
        .map((entry) => ({
            baseUrl: entry.baseUrl,
            paths: normalizeManualPathsRecord(entry.paths),
        }))
        .filter((entry) => Object.keys(entry.paths).length > 0);
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

function serializeExtensionAliases(extensionAlias: Readonly<Record<string, readonly string[]>>): string {
    return Object.entries(extensionAlias)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([targetExtension, sourceExtensions]) => `${targetExtension}=${sourceExtensions.join(',')}`)
        .join('|');
}

function toResolveCacheKey(input: ResolveInput, options: NormaizedResolveImportOptions): string {
    return [
        input.importerFile,
        input.specifier,
        options.extensions.join(','),
        serializeExtensionAliases(options.extensionAlias),
        options.useTsConfig ? 'ts:1' : 'ts:0',
        options.usePackageJson ? 'pkg:1' : 'pkg:0',
        serializeManualTsConfigs(options.manualTsConfigs),
    ].join('\u0000');
}

export type ResolverLike = {
    resolve: (input: ResolveInput) => null | ResolvedImport;
};

export class ImportResolver implements ResolverLike {
    private readonly options: NormaizedResolveImportOptions;
    private static readonly resolveCache = new LRUCache<string, { value: null | ResolvedImport }>({ max: 10_000 });
    private static readonly tsJsNearestCache = new LRUCache<string, { value: null | TsJsConfigCacheEntry }>({
        max: 5_000,
    });
    private static readonly packageNearestCache = new LRUCache<string, { value: null | PackageJsonCacheEntry }>({
        max: 5_000,
    });
    private static readonly manualAliasMatchPathCache = new LRUCache<string, MatchPath>({ max: 2_500 });

    public constructor(options: ResolveImportOptions = {}) {
        this.options = {
            extensionAlias: normalizeExtensionAliases(options.extensionAlias),
            extensions: options.extensions ?? DEFAULT_EXTENSIONS,
            useTsConfig: options.useTsConfig ?? true,
            usePackageJson: options.usePackageJson ?? true,
            manualTsConfigs: normalizeManualTsConfigs(options.manualTsConfigs),
        };
    }

    public resolve(input: ResolveInput): null | ResolvedImport {
        const normalizedInput = {
            importerFile: normalizePath(input.importerFile),
            specifier: normalizePath(input.specifier),
        };
        const key = toResolveCacheKey(normalizedInput, this.options);
        const cached = ImportResolver.resolveCache.get(key);

        if (cached !== undefined) {
            return cached.value;
        }

        const resolved = this.resolveUncached(input);
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

    private resolveUncached(input: ResolveInput): null | ResolvedImport {
        const importerFile = input.importerFile;
        const specifier = input.specifier;
        const options = this.options;
        const extensions = options.extensions;

        if (!specifier || !path.isAbsolute(importerFile)) {
            return null;
        }

        const relativeResolved = this.tryResolveRelative(importerFile, specifier, extensions);
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
                options.extensionAlias,
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
                options.extensionAlias
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
        extensions: readonly string[]
    ): string | undefined {
        if (!specifier.startsWith('.')) {
            return undefined;
        }

        const importerDir = path.dirname(importerFile);
        const candidate = path.resolve(importerDir, specifier);

        return resolveAsFileOrDirectory(candidate, extensions, this.options.extensionAlias);
    }

    private tryResolveWithTsconfigMatchPath(
        matchPath: MatchPath,
        specifier: string,
        extensions: readonly string[],
        extensionAlias: Readonly<Record<string, readonly string[]>>
    ): string | undefined {
        const mapped = matchPath(specifier, undefined, undefined, extensions);
        if (!mapped) {
            if (!hasAliasedExplicitExtension(specifier, extensionAlias)) {
                return undefined;
            }

            const extensionlessMapped = matchPath(removeExplicitExtension(specifier), undefined, undefined, extensions);
            if (!extensionlessMapped) {
                return undefined;
            }

            return resolveAsFileOrDirectory(extensionlessMapped, extensions, extensionAlias);
        }

        return resolveAsFileOrDirectory(mapped, extensions, extensionAlias);
    }

    private tryResolveWithTsconfigPaths(
        importerFile: string,
        specifier: string,
        extensions: readonly string[],
        extensionAlias: Readonly<Record<string, readonly string[]>>,
        useTsConfig: boolean,
        manualTsConfigs: readonly ManualTsConfigEntry[]
    ): { resolvedFile: string; tsJsConfig?: TsJsConfigCacheEntry } | null {
        const nearestConfig = useTsConfig ? this.getNearestTsJsConfig(importerFile) : null;

        if (nearestConfig?.matchPath) {
            const tsconfigResolved = this.tryResolveWithTsconfigMatchPath(
                nearestConfig.matchPath,
                specifier,
                extensions,
                extensionAlias
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
                extensionAlias
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
        extensionAlias: Readonly<Record<string, readonly string[]>>
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
            const aliasedTargetExtension = getAliasedTargetExtension(specifier, extensionAlias);
            if (!aliasedTargetExtension) {
                return null;
            }

            const explicitExtension = path.extname(specifier);
            const replacedSpecifier = `${specifier.slice(0, -explicitExtension.length)}.${aliasedTargetExtension}`;
            const aliasedResolved = this.resolveWithNode(importerFile, replacedSpecifier);
            if (!aliasedResolved || !hasCompatibleResolvedExtension(specifier, aliasedResolved, extensionAlias)) {
                return null;
            }

            const aliasedResolvedFile = resolveAsFileOrDirectory(aliasedResolved, extensions, extensionAlias);
            if (!aliasedResolvedFile) {
                return null;
            }

            return { resolvedFile: aliasedResolvedFile, packageJson: nearestPackageJson };
        }

        if (!hasCompatibleResolvedExtension(specifier, resolved, extensionAlias)) {
            return null;
        }

        const resolvedFile = resolveAsFileOrDirectory(resolved, extensions, extensionAlias);
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
        const memoized = ImportResolver.tsJsNearestCache.get(startDir);
        if (memoized !== undefined) {
            return memoized.value;
        }

        startDir = normalizePath(startDir);
        const loaded = loadConfig(startDir);

        if (loaded.resultType !== 'success') {
            let current = startDir;
            while (true) {
                ImportResolver.tsJsNearestCache.set(current, { value: null });
                const parent = path.dirname(current);
                if (parent === current) break;
                current = parent;
            }
            return null;
        }

        const configPath = normalizePath(loaded.configFileAbsolutePath);
        const configDir = path.dirname(configPath);
        const entry: TsJsConfigCacheEntry = {
            path: configPath,
            config: loaded,
            matchPath: createMatchPath(loaded.absoluteBaseUrl, loaded.paths, loaded.mainFields, loaded.addMatchAll),
        };

        let current = startDir;
        while (true) {
            ImportResolver.tsJsNearestCache.set(current, { value: entry });
            if (current === configDir) break;
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }

        return entry;
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
                const content = tryReadJson<PackageJsonContent>(packageJsonPath);

                if (content !== undefined) {
                    const entry: PackageJsonCacheEntry = {
                        path: normalizePath(packageJsonPath),
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

export function createImportResolver(options: ResolveImportOptions = {}): ImportResolver {
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
