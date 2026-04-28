import * as path from 'node:path';

import { normalizePath } from '../../normalizer.js';
import {
    addExtension,
    createImportResolver,
    getResolvedExtension,
    hasExplicitExtension,
    removeExplicitExtension,
    type ResolveInput,
    type ResolverLike,
} from '../../resolve.js';
import { buildNextResolveInput } from '../../util.js';
import type { ExtensionsCoreOptions, ExtensionsDecision } from './types.js';

type NormalizedCoreOptions = {
    caseInsensitive?: boolean;
    extensionMapping: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    manualTsConfigs?: ExtensionsCoreOptions['manualTsConfigs'];
    preferDirectoryIndex?: boolean;
    preferExtension?: boolean;
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

const DEFAULT_EXTENSION_MAPPING: Readonly<Record<string, string>> = {
    ts: 'js',
    tsx: 'jsx',
    mts: 'mjs',
    cts: 'cjs',
};

function normalizeExtensionToken(value: string): string {
    const withoutDot = value.startsWith('.') ? value.slice(1) : value;
    return withoutDot.trim().toLowerCase();
}

function normalizeExtensionMapping(
    extensionMapping: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> {
    const normalized: Record<string, string> = {};

    for (const [sourceKey, targetValue] of Object.entries(DEFAULT_EXTENSION_MAPPING)) {
        normalized[sourceKey] = targetValue;
    }

    if (!extensionMapping) {
        return normalized;
    }

    for (const [sourceKey, targetValue] of Object.entries(extensionMapping)) {
        if (typeof sourceKey !== 'string' || typeof targetValue !== 'string') {
            continue;
        }

        const from = normalizeExtensionToken(sourceKey);
        const to = normalizeExtensionToken(targetValue);
        if (from.length === 0 || to.length === 0) {
            continue;
        }

        normalized[from] = to;
    }

    return normalized;
}

function endsWithIndex(specifierWithoutExtension: string): boolean {
    return specifierWithoutExtension === 'index' || specifierWithoutExtension.endsWith('/index');
}

function stripIndexSegment(specifierWithoutExtension: string): string {
    if (specifierWithoutExtension.endsWith('/index')) {
        return specifierWithoutExtension.slice(0, -'/index'.length);
    }

    return specifierWithoutExtension;
}

function addIndexSegment(specifierWithoutExtension: string): string {
    if (endsWithIndex(specifierWithoutExtension)) {
        return specifierWithoutExtension;
    }

    return `${specifierWithoutExtension}/index`;
}

function splitSpecifier(specifier: string): { extension: string; withoutExtension: string } {
    if (!hasExplicitExtension(specifier)) {
        return { extension: '', withoutExtension: specifier };
    }

    const withoutExtension = removeExplicitExtension(specifier);
    return {
        extension: specifier.slice(withoutExtension.length),
        withoutExtension,
    };
}

function buildDecisionReason(currentSpecifier: string, nextSpecifier: string): ExtensionsDecision['reason'] {
    const currentSplit = splitSpecifier(currentSpecifier);
    const nextSplit = splitSpecifier(nextSpecifier);

    const extensionChanged = currentSplit.extension !== nextSplit.extension;
    const indexChanged = endsWithIndex(currentSplit.withoutExtension) !== endsWithIndex(nextSplit.withoutExtension);

    if (extensionChanged && indexChanged) {
        return 'extension-and-index';
    }

    if (indexChanged) {
        return 'index';
    }

    return 'extension';
}

export class ExtensionsCore {
    private readonly options: NormalizedCoreOptions;
    private readonly resolver: ResolverLike;

    public constructor(options: ExtensionsCoreOptions = {}, resolver?: ResolverLike) {
        this.options = {
            preferExtension: options.preferExtension ?? false,
            preferDirectoryIndex: options.preferDirectoryIndex ?? false,
            extensionMapping: normalizeExtensionMapping(options.extensionMapping),
            caseInsensitive: options.caseInsensitive,
            extensions: options.extensions,
            manualTsConfigs: options.manualTsConfigs,
            usePackageJson: options.usePackageJson,
            useTsConfig: options.useTsConfig,
        };

        this.resolver =
            resolver ??
            createImportResolver({
                extensions: options.extensions,
                caseInsensitive: options.caseInsensitive,
                usePackageJson: options.usePackageJson,
                useTsConfig: options.useTsConfig,
                manualTsConfigs: options.manualTsConfigs,
            });
    }

    public evaluate(input: ResolveInput): ExtensionsDecision | null {
        const resolved = this.resolver.resolve(input);
        if (!resolved) {
            return null;
        }

        const nextSpecifier = this.buildNextSpecifier(input.specifier, resolved.resolvedFile);
        if (nextSpecifier === input.specifier) {
            return null;
        }

        if (!this.isSafeRewrite(input, resolved.resolvedFile, nextSpecifier)) {
            return null;
        }

        return {
            kind: 'rewrite',
            nextSpecifier,
            reason: buildDecisionReason(input.specifier, nextSpecifier),
            resolved,
        };
    }

    private buildNextSpecifier(specifier: string, resolvedFile: string): string {
        const realExtension = normalizeExtensionToken(getResolvedExtension(resolvedFile));
        const importExtension = this.options.extensionMapping[realExtension] ?? realExtension;

        const specifierWithoutExtension = removeExplicitExtension(specifier);
        let normalized = specifierWithoutExtension;

        const isIndexResolvedFile = path.basename(resolvedFile, path.extname(resolvedFile)) === 'index';
        if (isIndexResolvedFile) {
            normalized = this.options.preferDirectoryIndex
                ? addIndexSegment(normalized)
                : stripIndexSegment(normalized);
        }

        if (!this.options.preferExtension) {
            return normalized;
        }

        return addExtension(normalized, importExtension);
    }

    private isSafeRewrite(input: ResolveInput, originalResolvedFile: string, nextSpecifier: string): boolean {
        const directNextResolved = this.resolver.resolve(buildNextResolveInput(input, nextSpecifier));
        const caseInsensitive = this.options.caseInsensitive ?? false;

        if (directNextResolved) {
            return (
                normalizePath(directNextResolved.resolvedFile, caseInsensitive) ===
                normalizePath(originalResolvedFile, caseInsensitive)
            );
        }

        if (!this.options.preferExtension) {
            return false;
        }

        const originalExtension = normalizeExtensionToken(getResolvedExtension(originalResolvedFile));
        const mappedImportExtension = this.options.extensionMapping[originalExtension] ?? originalExtension;

        if (mappedImportExtension === originalExtension) {
            return false;
        }

        const extensionlessCandidate = removeExplicitExtension(nextSpecifier);
        const extensionlessResolved = this.resolver.resolve(buildNextResolveInput(input, extensionlessCandidate));
        if (!extensionlessResolved) {
            return false;
        }

        return (
            normalizePath(extensionlessResolved.resolvedFile, caseInsensitive) ===
            normalizePath(originalResolvedFile, caseInsensitive)
        );
    }
}

export function createExtensionsCore(options: ExtensionsCoreOptions = {}, resolver?: ResolverLike): ExtensionsCore {
    return new ExtensionsCore(options, resolver);
}
