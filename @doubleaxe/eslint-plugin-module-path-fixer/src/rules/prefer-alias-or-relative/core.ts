import * as path from 'node:path';

import { createImportResolver, getParentTraversalDepth } from '../../resolve.js';
import { collectAliasCandidatesForResolvedImport } from './alias-candidates.js';
import type {
    PreferAliasOrRelativeCoreOptions,
    PreferAliasOrRelativeDecision,
    PreferAliasOrRelativeInput,
    ResolverLike,
} from './types.js';

type NormalizedCoreOptions = {
    caseInsensitive?: boolean;
    depth: number;
    extensions?: readonly string[];
    manualTsConfigs?: PreferAliasOrRelativeCoreOptions['manualTsConfigs'];
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

function normalizeDepth(depth: number | undefined): number {
    if (depth === undefined || Number.isNaN(depth) || !Number.isFinite(depth)) {
        return 1;
    }

    return Math.trunc(depth);
}

function normalizePathForCompare(value: string, caseInsensitive: boolean): string {
    const normalized = path.normalize(value);
    return caseInsensitive ? normalized.toLowerCase() : normalized;
}

function removeExtension(specifier: string): string {
    const extension = path.extname(specifier);
    if (!extension) {
        return specifier;
    }

    return specifier.slice(0, -extension.length);
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

function buildResolveInput(
    input: PreferAliasOrRelativeInput,
    options: NormalizedCoreOptions,
    specifier: string
): {
    caseInsensitive?: boolean;
    extensions?: readonly string[];
    importerFile: string;
    manualTsConfigs?: PreferAliasOrRelativeCoreOptions['manualTsConfigs'];
    specifier: string;
    usePackageJson?: boolean;
    useTsConfig?: boolean;
} {
    return {
        importerFile: input.importerFile,
        specifier,
        extensions: options.extensions,
        caseInsensitive: options.caseInsensitive,
        usePackageJson: options.usePackageJson,
        useTsConfig: options.useTsConfig,
        manualTsConfigs: options.manualTsConfigs,
    };
}

export class PreferAliasOrRelativeCore {
    private readonly options: NormalizedCoreOptions;
    private readonly resolver: ResolverLike;

    public constructor(options: PreferAliasOrRelativeCoreOptions = {}, resolver?: ResolverLike) {
        this.options = {
            depth: normalizeDepth(options.depth),
            caseInsensitive: options.caseInsensitive,
            extensions: options.extensions,
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
        const resolved = this.resolver.resolve(buildResolveInput(input, this.options, input.specifier));
        if (!resolved) {
            return null;
        }

        if (input.specifier.startsWith('.')) {
            return this.tryConvertRelativeToAlias(input, resolved);
        }

        return this.tryConvertAliasToRelative(input, resolved);
    }

    private tryConvertRelativeToAlias(
        input: PreferAliasOrRelativeInput,
        resolved: NonNullable<ReturnType<ResolverLike['resolve']>>
    ): null | PreferAliasOrRelativeDecision {
        if (this.options.depth < 0) {
            return null;
        }

        const traversalDepth = getParentTraversalDepth(input.specifier);
        if (traversalDepth <= this.options.depth) {
            return null;
        }

        const aliases = collectAliasCandidatesForResolvedImport(resolved, {
            manualTsConfigs: this.options.manualTsConfigs,
        }).sort(compareByLengthThenLex);

        for (const aliasSpecifier of aliases) {
            const aliasResolved = this.resolver.resolve(buildResolveInput(input, this.options, aliasSpecifier));
            if (!aliasResolved) {
                continue;
            }

            if (
                normalizePathForCompare(aliasResolved.resolvedFile, this.options.caseInsensitive ?? false) !==
                normalizePathForCompare(resolved.resolvedFile, this.options.caseInsensitive ?? false)
            ) {
                continue;
            }

            return {
                kind: 'to-alias',
                nextSpecifier: aliasSpecifier,
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
            const traversalDepth = getParentTraversalDepth(relativeSpecifier);
            const depthAllowed = this.options.depth < 0 || traversalDepth <= this.options.depth;
            if (!depthAllowed) {
                continue;
            }

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
}

export function createPreferAliasOrRelativeCore(
    options: PreferAliasOrRelativeCoreOptions = {},
    resolver?: ResolverLike
): PreferAliasOrRelativeCore {
    return new PreferAliasOrRelativeCore(options, resolver);
}
