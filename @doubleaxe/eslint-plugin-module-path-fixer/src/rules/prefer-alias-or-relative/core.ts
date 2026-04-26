import * as path from 'node:path';

import { createImportResolver, type ResolverLike } from '../../resolve.js';
import { buildResolveInput, normalizePathForCompare } from '../utils.js';
import { collectAliasCandidatesForResolvedImport } from './alias-candidates.js';
import type {
    PreferAliasOrRelativeCoreOptions,
    PreferAliasOrRelativeDecision,
    PreferAliasOrRelativeInput,
} from './types.js';

type NormalizedCoreOptions = {
    caseInsensitive?: boolean;
    extensions?: readonly string[];
    manualTsConfigs?: PreferAliasOrRelativeCoreOptions['manualTsConfigs'];
    parentFolderAliasDepth: number;
    preferFolderAlias: boolean;
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

function normalizeParentFolderAliasDepth(depth: number | undefined): number {
    if (depth === undefined || Number.isNaN(depth) || !Number.isFinite(depth)) {
        return 0;
    }

    return Math.trunc(depth);
}

function toPosix(value: string): string {
    return value.split(path.sep).join('/');
}

function ensureRelativePrefix(specifier: string): string {
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
        return specifier;
    }

    return `./${specifier}`;
}

function compareByLengthThenLex(a: string, b: string): number {
    if (a.length !== b.length) {
        return a.length - b.length;
    }

    return a.localeCompare(b);
}

function normalizeRelativeSpecifier(specifier: string): string {
    const normalized = path.posix.normalize(specifier);
    if (normalized === '.' || normalized.length === 0) {
        return './';
    }

    if (normalized.startsWith('.')) {
        return normalized;
    }

    return ensureRelativePrefix(normalized);
}

function toPosixPath(value: string): string {
    return value.split(path.sep).join('/');
}

function removeExtension(specifier: string): string {
    const extension = path.extname(specifier);
    if (!extension) {
        return specifier;
    }

    return specifier.slice(0, -extension.length);
}

function buildSubpathCandidates(baseDir: string, resolvedFile: string): string[] {
    const relativeToBase = path.relative(baseDir, resolvedFile);
    if (!relativeToBase || relativeToBase.startsWith('..') || path.isAbsolute(relativeToBase)) {
        return [];
    }

    const withExt = toPosixPath(relativeToBase);
    const withoutExt = removeExtension(withExt);
    const candidates = [withExt, withoutExt];

    if (withoutExt.endsWith('/index')) {
        const withoutIndex = withoutExt.slice(0, -'/index'.length);
        if (withoutIndex.length > 0) {
            candidates.push(withoutIndex);
        }
    }

    return [...new Set(candidates)];
}

function matchesSubpath(aliasSpecifier: string, subpath: string): boolean {
    if (aliasSpecifier === subpath) {
        return true;
    }

    if (aliasSpecifier.startsWith('#') && aliasSpecifier.slice(1) === subpath) {
        return true;
    }

    return aliasSpecifier.endsWith(`/${subpath}`);
}

function getLeadingParentDepth(specifier: string): number {
    if (!specifier.startsWith('.')) {
        return 0;
    }

    const segments = specifier.split('/');
    let depth = 0;

    for (const segment of segments) {
        if (segment === '..') {
            depth += 1;
            continue;
        }

        break;
    }

    return depth;
}

function getBackwardFolderSpecifiers(specifier: string): string[] {
    const segments = specifier.split('/');
    const candidates: string[] = [];

    for (let end = segments.length - 1; end >= 0; end -= 1) {
        const folderSegments = segments.slice(0, end);
        if (folderSegments.length === 0) {
            candidates.push('.');
            continue;
        }

        candidates.push(folderSegments.join('/'));
    }

    return candidates;
}

function getParentAnchorSpecifier(depth: number): string {
    if (depth <= 0) {
        return '.';
    }

    return new Array(depth).fill('..').join('/');
}

function buildRelativeCandidates(importerFile: string, resolvedFile: string): string[] {
    const importerDir = path.dirname(importerFile);
    const relativeWithExt = ensureRelativePrefix(toPosix(path.relative(importerDir, resolvedFile)));
    if (!relativeWithExt || relativeWithExt === './') {
        return [];
    }

    const relativeNoExt = removeExtension(relativeWithExt);
    const candidates = [relativeNoExt];

    if (relativeNoExt.endsWith('/index')) {
        const withoutIndex = relativeNoExt.slice(0, -'/index'.length);
        if (withoutIndex.length > 0) {
            candidates.push(withoutIndex);
        }
    }

    return [...new Set(candidates)].sort(compareByLengthThenLex);
}

export class PreferAliasOrRelativeCore {
    private readonly options: NormalizedCoreOptions;
    private readonly resolver: ResolverLike;

    public constructor(options: PreferAliasOrRelativeCoreOptions = {}, resolver?: ResolverLike) {
        this.options = {
            caseInsensitive: options.caseInsensitive,
            extensions: options.extensions,
            preferFolderAlias: options.preferFolderAlias ?? true,
            parentFolderAliasDepth: normalizeParentFolderAliasDepth(options.parentFolderAliasDepth),
            usePackageJson: options.usePackageJson,
            useTsConfig: options.useTsConfig,
            manualTsConfigs: options.manualTsConfigs,
        };
        this.resolver =
            resolver ??
            createImportResolver({
                caseInsensitive: options.caseInsensitive,
                usePackageJson: options.usePackageJson,
                useTsConfig: options.useTsConfig,
                manualTsConfigs: options.manualTsConfigs,
            });
    }

    public evaluate(input: PreferAliasOrRelativeInput): null | PreferAliasOrRelativeDecision {
        const isLocalRelative = input.specifier.startsWith('./');
        const isParentRelative = input.specifier.startsWith('..');
        const isPackageImport = input.specifier.startsWith('#');

        let normalizedSpecifier: string;
        let normalizedInput: PreferAliasOrRelativeInput;

        if (isPackageImport) {
            normalizedSpecifier = normalizeRelativeSpecifier(input.specifier);
            normalizedInput = { ...input, specifier: normalizedSpecifier };
        } else if (input.specifier.startsWith('.')) {
            normalizedSpecifier = normalizeRelativeSpecifier(input.specifier);
            normalizedInput = { ...input, specifier: normalizedSpecifier };
        } else {
            normalizedSpecifier = input.specifier;
            normalizedInput = input;
        }

        const resolved = this.resolver.resolve(
            buildResolveInput(normalizedInput, this.options, normalizedInput.specifier)
        );
        if (!resolved) {
            return null;
        }

        if (normalizedInput.specifier.startsWith('.')) {
            const result = this.tryConvertRelativeToAlias(normalizedInput, resolved);
            if (result) {
                return result;
            }
            const needsNormalization = (isLocalRelative || isParentRelative) && normalizedSpecifier !== input.specifier;
            if (needsNormalization) {
                return {
                    kind: 'to-relative',
                    nextSpecifier: normalizedSpecifier,
                    resolved,
                };
            }
            return null;
        }

        if (isPackageImport) {
            const result = this.tryConvertAliasToRelative(normalizedInput, resolved);
            if (result) {
                return result;
            }
            if (normalizedSpecifier !== input.specifier) {
                return {
                    kind: 'to-relative',
                    nextSpecifier: normalizedSpecifier,
                    resolved,
                };
            }
            return null;
        }

        return this.tryConvertAliasToRelative(normalizedInput, resolved);
    }

    private tryConvertRelativeToAlias(
        input: PreferAliasOrRelativeInput,
        resolved: NonNullable<ReturnType<ResolverLike['resolve']>>
    ): null | PreferAliasOrRelativeDecision {
        const aliases = collectAliasCandidatesForResolvedImport(resolved, {
            manualTsConfigs: this.options.manualTsConfigs,
        });
        const verifiedAliases = aliases
            .sort(compareByLengthThenLex)
            .filter((aliasSpecifier) => this.isAliasSpecifierEquivalent(input, resolved, aliasSpecifier));

        if (this.options.preferFolderAlias) {
            const folderAlias = this.findAliasByBackwardFolderWalk(input, resolved, verifiedAliases);
            if (folderAlias) {
                return {
                    kind: 'to-alias',
                    nextSpecifier: folderAlias,
                    resolved,
                };
            }
        }

        if (input.specifier === '.' || input.specifier.startsWith('./')) {
            return null;
        }

        const traversalDepth = getLeadingParentDepth(input.specifier);
        if (this.options.parentFolderAliasDepth < 0) {
            return null;
        }

        if (traversalDepth <= this.options.parentFolderAliasDepth) {
            return null;
        }

        const parentAnchorAlias = this.findAliasNearestToParentFolder(input, resolved, verifiedAliases, traversalDepth);
        if (parentAnchorAlias) {
            return {
                kind: 'to-alias',
                nextSpecifier: parentAnchorAlias,
                resolved,
            };
        }

        return null;
    }

    private tryConvertAliasToRelative(
        input: PreferAliasOrRelativeInput,
        resolved: NonNullable<ReturnType<ResolverLike['resolve']>>
    ): null | PreferAliasOrRelativeDecision {
        const relativeCandidates = buildRelativeCandidates(input.importerFile, resolved.resolvedFile);

        for (const relativeSpecifier of relativeCandidates) {
            const relativeResolved = this.resolver.resolve(buildResolveInput(input, this.options, relativeSpecifier));
            if (!relativeResolved) {
                continue;
            }

            if (
                normalizePathForCompare(relativeResolved.resolvedFile, this.options.caseInsensitive ?? false) !==
                normalizePathForCompare(resolved.resolvedFile, this.options.caseInsensitive ?? false)
            ) {
                continue;
            }

            return {
                kind: 'to-relative',
                nextSpecifier: relativeSpecifier,
                resolved,
            };
        }

        return null;
    }

    private isAliasSpecifierEquivalent(
        input: PreferAliasOrRelativeInput,
        resolved: NonNullable<ReturnType<ResolverLike['resolve']>>,
        aliasSpecifier: string
    ): boolean {
        const aliasResolved = this.resolver.resolve(buildResolveInput(input, this.options, aliasSpecifier));
        if (!aliasResolved) {
            return false;
        }

        return (
            normalizePathForCompare(aliasResolved.resolvedFile, this.options.caseInsensitive ?? false) ===
            normalizePathForCompare(resolved.resolvedFile, this.options.caseInsensitive ?? false)
        );
    }

    private findAliasByBackwardFolderWalk(
        input: PreferAliasOrRelativeInput,
        resolved: NonNullable<ReturnType<ResolverLike['resolve']>>,
        aliases: readonly string[]
    ): null | string {
        const importerDir = path.dirname(input.importerFile);
        const folderSpecifiers = getBackwardFolderSpecifiers(input.specifier);

        for (const folderSpecifier of folderSpecifiers) {
            if (folderSpecifier === '.') {
                break;
            }

            const folderAbs = path.resolve(importerDir, folderSpecifier);
            const subpathCandidates = buildSubpathCandidates(folderAbs, resolved.resolvedFile);
            if (subpathCandidates.length === 0) {
                continue;
            }

            for (const aliasSpecifier of aliases) {
                if (subpathCandidates.some((subpath) => matchesSubpath(aliasSpecifier, subpath))) {
                    return aliasSpecifier;
                }
            }
        }

        return null;
    }

    private findAliasNearestToParentFolder(
        input: PreferAliasOrRelativeInput,
        resolved: NonNullable<ReturnType<ResolverLike['resolve']>>,
        aliases: readonly string[],
        traversalDepth: number
    ): null | string {
        const importerDir = path.dirname(input.importerFile);
        const parentAnchorSpecifier = getParentAnchorSpecifier(traversalDepth);
        let currentDir = path.resolve(importerDir, parentAnchorSpecifier);

        while (true) {
            const subpathCandidates = buildSubpathCandidates(currentDir, resolved.resolvedFile);
            if (subpathCandidates.length > 0) {
                for (const aliasSpecifier of aliases) {
                    if (subpathCandidates.some((subpath) => matchesSubpath(aliasSpecifier, subpath))) {
                        return aliasSpecifier;
                    }
                }
            }

            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                return null;
            }

            currentDir = parentDir;
        }
    }
}

export function createPreferAliasOrRelativeCore(
    options: PreferAliasOrRelativeCoreOptions = {},
    resolver?: ResolverLike
): PreferAliasOrRelativeCore {
    return new PreferAliasOrRelativeCore(options, resolver);
}
