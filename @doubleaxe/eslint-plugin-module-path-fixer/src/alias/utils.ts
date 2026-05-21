import * as path from 'node:path/posix';

import { dirExists, fileExists, type FileSystem } from '../fscache.js';
import { normalizePath } from '../normalizer.js';
import type { ReverseExtensionAlias, SpecifierClassType } from '../types.js';
import type { AbsolutePathAliasArray, ResolvedAlias, ResolvedPath } from './types.js';

export function tryResolveTargetPath(
    fileSystem: FileSystem,
    targetPath: string,
    extensions: readonly string[],
    extensionAlias: ReverseExtensionAlias
): ResolvedPath | undefined {
    targetPath = normalizePath(targetPath);

    const targetExtension = path.extname(targetPath);
    const targetWithoutExtension = targetPath.slice(0, -targetExtension.length);

    if (!targetExtension) {
        // try extensions
        for (const extension of extensions) {
            const tryName = `${targetPath}${extension}`;
            if (fileExists(fileSystem, tryName)) {
                return { path: tryName, specifierKind: 'FileWithoutExtension' };
            }
        }
    } else {
        // try alias
        const alias = extensionAlias[targetExtension];
        // fallback
        let tryOriginalName = true;
        if (alias) {
            for (const extension of extensions) {
                const isOriginalName = extension === targetExtension;
                if (isOriginalName) tryOriginalName = false;
                const tryName = `${targetWithoutExtension}${extension}`;
                if (fileExists(fileSystem, tryName)) {
                    return {
                        path: tryName,
                        specifierKind: isOriginalName ? 'FileWithExtension' : 'FileWithExtensionAlias',
                    };
                }
            }
        }

        if (tryOriginalName) {
            if (fileExists(fileSystem, targetPath)) {
                return {
                    path: targetPath,
                    specifierKind: 'FileWithExtension',
                };
            }
        }
    }

    if (dirExists(fileSystem, targetPath)) {
        const indexPath = path.join(targetPath, 'index');
        for (const extension of extensions) {
            const tryName = `${indexPath}${extension}`;
            if (fileExists(fileSystem, tryName)) {
                return {
                    path: tryName,
                    specifierKind: 'IndexDir',
                };
            }
        }
    }

    return undefined;
}

export function parseAliasWithStar(pattern: string) {
    const isMatchAll = pattern === '*';
    const starIndex = isMatchAll ? -1 : pattern.indexOf('*');
    let headPart = '';
    let tailPart = '';
    if (!isMatchAll && starIndex >= 0) {
        headPart = pattern.substring(0, starIndex);
        tailPart = pattern.substring(starIndex + 1);
    }

    function matchStar(search: string) {
        if (isMatchAll) return true;
        if (starIndex < 0) return pattern === search;
        return search.startsWith(headPart) && search.endsWith(tailPart);
    }

    function cutStar(search: string) {
        if (isMatchAll) return search;
        if (starIndex < 0) return pattern;
        return search.substring(starIndex, search.length - tailPart.length);
    }

    function buildStar(part: string) {
        if (isMatchAll) return part;
        if (starIndex < 0) return pattern;
        return `${headPart}${part}${tailPart}`;
    }

    return {
        pattern,
        isMatchAll,
        isHaveStar: isMatchAll || starIndex >= 0,
        haveTail: !!tailPart,
        matchStar,
        cutStar,
        buildStar,
    };
}

export type ParsedAlias = ReturnType<typeof parseAliasWithStar>;

export function resolveAliasTargetPath(
    fileSystem: FileSystem,
    specifier: string,
    aliasMappings: AbsolutePathAliasArray,
    extensions: readonly string[],
    extensionAlias: ReverseExtensionAlias
): ResolvedAlias | undefined {
    for (const alias of aliasMappings) {
        const parsedAlias = alias.parsedAlias;
        if (!parsedAlias.matchStar(specifier)) continue;
        const specifierPart = parsedAlias.cutStar(specifier);
        for (const target of alias.targets) {
            const targetCandidate = target.parsedAbsolutePattern.buildStar(specifierPart);
            const resolvedTarget = tryResolveTargetPath(fileSystem, targetCandidate, extensions, extensionAlias);
            if (resolvedTarget) {
                let specifierClass: SpecifierClassType;
                if (!parsedAlias.isHaveStar) {
                    specifierClass = 'StaticAlias';
                } else if (parsedAlias.haveTail) {
                    specifierClass = 'StarAliasWithTail';
                } else {
                    specifierClass = 'StarAlias';
                }
                return { ...resolvedTarget, specifierClass };
            }
        }
    }
    return undefined;
}
