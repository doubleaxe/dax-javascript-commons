import * as path from 'node:path/posix';

import { LRUCache } from 'lru-cache';

import { fileExists, type FileSystem } from '../fscache.js';
import { normalizePath } from '../normalizer.js';
import { buildPackageImportAliases } from './package-imports.js';
import { buildTsconfigAliases } from './tsconfig.js';
import type { AbsolutePathAliasArray, AliasCacheEntry, AliasEntry } from './types.js';

function findNearestFile<T>(
    fileSystem: FileSystem,
    startDir: string,
    cache: LRUCache<string, { value: null | T }>,
    fileNames: readonly string[],
    parserFn: (filePath: string, currentDir: string) => null | T,
    errorLog?: boolean
): null | T {
    const relativeFileNames = [];
    for (const fileName of fileNames) {
        if (path.posix.isAbsolute(fileName) || path.win32.isAbsolute(fileName)) {
            const memoized = cache.get(fileName);
            if (memoized !== undefined) {
                if (memoized.value) return memoized.value;
                continue;
            }

            if (fileExists(fileSystem, fileName)) {
                try {
                    const parsedObject = parserFn(fileName, path.dirname(fileName));
                    if (parsedObject) {
                        cache.set(fileName, { value: parsedObject });
                        return parsedObject;
                    }
                } catch (err) {
                    if (errorLog) console.error(err);
                }
            }

            cache.set(fileName, { value: null });
        } else {
            relativeFileNames.push(fileName);
        }
    }

    let currentDir = startDir;
    const visited: string[] = [];

    while (true) {
        const memoized = cache.get(currentDir);
        if (memoized !== undefined) {
            for (const dir of visited) {
                cache.set(dir, memoized);
            }
            return memoized.value;
        }

        visited.push(currentDir);

        for (const fileName of relativeFileNames) {
            const filePath = path.join(currentDir, fileName);
            if (fileExists(fileSystem, filePath)) {
                try {
                    const parsedObject = parserFn(filePath, currentDir);
                    if (parsedObject) {
                        for (const dir of visited) {
                            cache.set(dir, { value: parsedObject });
                        }
                        return parsedObject;
                    }
                } catch (err) {
                    if (errorLog) console.error(err);
                }
            }
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            for (const dir of visited) {
                cache.set(dir, { value: null });
            }
            return null;
        }

        currentDir = parentDir;
    }
}

function normalizeResolvedAliasTarget(baseUrl: string, target: string): string {
    const isAbsolute = path.posix.isAbsolute(target) || path.win32.isAbsolute(target);
    return normalizePath(isAbsolute ? target : path.join(baseUrl, target));
}

export function buildAbsoluteAliasOptions(aliasEntries: readonly AliasEntry[]): AbsolutePathAliasArray {
    const aliasOptions: AbsolutePathAliasArray = [];

    for (const aliasEntry of aliasEntries) {
        const normalizedBaseUrl = normalizePath(aliasEntry.baseUrl);
        const baseUrl =
            path.posix.isAbsolute(normalizedBaseUrl) || path.win32.isAbsolute(normalizedBaseUrl)
                ? normalizedBaseUrl
                : normalizePath(path.join(process.cwd(), aliasEntry.baseUrl));

        for (const [alias, aliasPaths] of Object.entries(aliasEntry.paths)) {
            const resolvedTargets = aliasPaths.map((aliasPath) => ({
                absolutePattern: normalizeResolvedAliasTarget(baseUrl, aliasPath),
                originalPattern: aliasPath,
                baseDir: baseUrl,
            }));
            aliasOptions.push({
                alias,
                targets: resolvedTargets,
            });
        }
    }

    return aliasOptions;
}

type CreateAliasOptions = {
    errorLog?: boolean;
    fileSystem: FileSystem;
    packageJsonNames: null | string[];
    tsconfigNames: null | string[];
};

const CONFIG_CACHE_TTL = 30_000;

export function createAliasParser({ fileSystem, packageJsonNames, tsconfigNames, errorLog }: CreateAliasOptions) {
    // cannot be static, because uses options
    const tsconfigCache = new LRUCache<string, { value: AliasCacheEntry | null }>({
        max: 100,
        ttl: CONFIG_CACHE_TTL,
    });
    const packageJsonCache = new LRUCache<string, { value: AliasCacheEntry | null }>({
        max: 100,
        ttl: CONFIG_CACHE_TTL,
    });

    function findNearestTsJsConfig(startDir: string): AliasCacheEntry | null {
        if (!tsconfigNames) return null;
        const foundObject = findNearestFile(
            fileSystem,
            startDir,
            tsconfigCache,
            tsconfigNames,
            (foundPath) => {
                foundPath = normalizePath(foundPath);

                const entry: AliasCacheEntry = {
                    alias: [],
                    path: foundPath,
                };
                const aliases = buildTsconfigAliases(fileSystem, foundPath);
                if (aliases) entry.alias = buildAbsoluteAliasOptions([aliases]);

                return entry;
            },
            errorLog
        );

        return foundObject;
    }

    function findNearestPackageJson(startDir: string): AliasCacheEntry | null {
        if (!packageJsonNames) return null;
        const foundObject = findNearestFile(
            fileSystem,
            startDir,
            packageJsonCache,
            packageJsonNames,
            (foundPath) => {
                foundPath = normalizePath(foundPath);
                const entry: AliasCacheEntry = {
                    alias: [],
                    path: foundPath,
                };
                const imports = buildPackageImportAliases(fileSystem, foundPath);
                if (imports) entry.alias = buildAbsoluteAliasOptions([imports]);

                return entry;
            },
            errorLog
        );

        return foundObject;
    }

    function getNearestTsJsConfig(fileDir: string, skipNormalize?: boolean): AliasCacheEntry | null {
        if (!skipNormalize) fileDir = normalizePath(fileDir);
        const cached = tsconfigCache.get(fileDir);

        if (cached !== undefined) {
            return cached.value;
        }

        const nearest = findNearestTsJsConfig(fileDir);
        tsconfigCache.set(fileDir, { value: nearest });

        return nearest;
    }

    function getNearestPackageJson(fileDir: string, skipNormalize?: boolean): AliasCacheEntry | null {
        if (!skipNormalize) fileDir = normalizePath(fileDir);
        const cached = packageJsonCache.get(fileDir);

        if (cached !== undefined) {
            return cached.value;
        }

        const nearest = findNearestPackageJson(fileDir);
        packageJsonCache.set(fileDir, { value: nearest });

        return nearest;
    }

    return {
        getNearestTsJsConfig,
        getNearestPackageJson,
    };
}
