import * as path from 'node:path/posix';

import { dirExists, fileExists, type FileSystem } from '../fscache.js';
import { normalizePath } from '../normalizer.js';
import type { AbsolutePathAliasArray, ReverseExtensionAlias } from './types.js';

export function tryResolveTargetPath(
    fileSystem: FileSystem,
    targetPath: string,
    extensions: readonly string[],
    extensionAlias: ReverseExtensionAlias
): string | undefined {
    targetPath = normalizePath(targetPath);

    const targetExtension = path.extname(targetPath);
    const targetWithoutExtension = targetPath.slice(0, -targetExtension.length);

    if (!targetExtension) {
        // try extensions
        for (const extension of extensions) {
            const tryName = `${targetPath}${extension}`;
            if (fileExists(fileSystem, tryName)) {
                return tryName;
            }
        }
    } else {
        // try alias
        const alias = extensionAlias[targetExtension];
        // fallback
        let tryOriginalName = true;
        if (alias) {
            for (const extension of extensions) {
                if (extension === targetExtension) tryOriginalName = false;
                const tryName = `${targetWithoutExtension}${extension}`;
                if (fileExists(fileSystem, tryName)) {
                    return tryName;
                }
            }
        }

        if (tryOriginalName) {
            if (fileExists(fileSystem, targetPath)) {
                return targetPath;
            }
        }
    }

    if (dirExists(fileSystem, targetPath)) {
        const indexPath = path.join(targetPath, 'index');
        for (const extension of extensions) {
            const tryName = `${indexPath}${extension}`;
            if (fileExists(fileSystem, tryName)) {
                return tryName;
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
): string | undefined {
    for (const alias of aliasMappings) {
        if (!alias.parsedAlias.matchStar(specifier)) continue;
        const specifierPart = alias.parsedAlias.cutStar(specifier);
        for (const target of alias.targets) {
            const targetCandidate = target.parsedAbsolutePattern.buildStar(specifierPart);
            const resolvedTarget = tryResolveTargetPath(fileSystem, targetCandidate, extensions, extensionAlias);
            if (resolvedTarget) {
                return resolvedTarget;
            }
        }
    }
    return undefined;
}
