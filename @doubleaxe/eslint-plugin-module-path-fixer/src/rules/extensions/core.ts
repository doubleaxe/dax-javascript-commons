import * as path from 'node:path/posix';

import { normalizePath } from '../../normalizer.js';
import { createImportResolver, type ResolveInput, type ResolverLike } from '../../resolve.js';
import { buildNextResolveInput } from '../../util.js';
import type { ExtensionsCoreOptions, ExtensionsDecision } from './types.js';

type NormalizedCoreOptions = {
    extensionAlias: Readonly<Record<string, string>>;
    preferDirectoryIndex?: boolean;
    preferExtension?: boolean;
};

function addExtension(specifier: string, extension: string): string {
    const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
    return `${specifier}${normalizedExtension}`;
}

const INDEX_SEGMENT = '/index';
const INDEX_SEGMENT2 = '\\index';
function stripIndexSegment(specifierWithoutExtension: string): string {
    if (specifierWithoutExtension.endsWith(INDEX_SEGMENT)) {
        return specifierWithoutExtension.slice(0, -INDEX_SEGMENT.length);
    }
    if (specifierWithoutExtension.endsWith(INDEX_SEGMENT2)) {
        return specifierWithoutExtension.slice(0, -INDEX_SEGMENT2.length);
    }

    if (specifierWithoutExtension.endsWith('/') || specifierWithoutExtension.endsWith('\\')) {
        // if we don't strip ending slash, and it is normalized out - it could become ambigous
        return specifierWithoutExtension.slice(0, -1);
    }
    return specifierWithoutExtension;
}

function addIndexSegment(specifierWithoutExtension: string): string {
    if (
        specifierWithoutExtension === 'index' ||
        specifierWithoutExtension.endsWith(INDEX_SEGMENT) ||
        specifierWithoutExtension.endsWith(INDEX_SEGMENT2)
    ) {
        return specifierWithoutExtension;
    }

    if (specifierWithoutExtension.endsWith('/') || specifierWithoutExtension.endsWith('\\')) {
        return `${specifierWithoutExtension}index`;
    }
    return `${specifierWithoutExtension}/index`;
}

export class ExtensionsCore {
    private readonly options: NormalizedCoreOptions;
    private readonly resolver: ResolverLike;

    public constructor(options: ExtensionsCoreOptions = {}) {
        this.resolver = createImportResolver({
            extensions: options.extensions,
            extensionAlias: options.extensionAlias,
            resolveCacheTtl: options.resolveCacheTtl,
            usePackageJson: options.usePackageJson,
            useTsConfig: options.useTsConfig,
            manualAliases: options.manualAliases,
        });

        // resolver can normalize extensions
        this.options = {
            preferExtension: options.preferExtension ?? false,
            preferDirectoryIndex: options.preferDirectoryIndex ?? false,
            extensionAlias: this.resolver.getExtensionAliases(),
        };
    }

    public evaluate(input: ResolveInput): ExtensionsDecision {
        const resolved = this.resolver.resolve(input);
        if (!resolved) {
            return { reason: 'unresolved' };
        }

        const { resolvedFile, specifierClass } = resolved;

        const nextSpecifier = this.buildNextSpecifier(input.specifier, resolvedFile);
        if (nextSpecifier === input.specifier) {
            return { reason: 'unchanged' };
        }

        if (specifierClass === 'StaticAlias' || specifierClass === 'StarAliasWithTail') {
            // cannot rewrite extension of static alias
            return { reason: 'unsafe' };
        }

        if (!this.isSafeRewrite(input, resolvedFile, nextSpecifier)) {
            return { reason: 'unsafe' };
        }

        return {
            reason: 'changed',
            nextSpecifier,
            resolvedFile,
        };
    }

    private buildNextSpecifier(specifier: string, resolvedFile: string): string {
        const resolvedExtension = path.extname(resolvedFile);

        // normalize to posix
        const specifierExtension = path.extname(normalizePath(specifier));
        const specifierWithoutExtension = specifierExtension
            ? specifier.slice(0, -specifierExtension.length)
            : specifier;
        let normalized = specifierWithoutExtension;

        const isIndexResolvedFile = path.basename(resolvedFile, resolvedExtension) === 'index';
        if (isIndexResolvedFile) {
            normalized = this.options.preferDirectoryIndex
                ? addIndexSegment(normalized)
                : stripIndexSegment(normalized);

            if (!this.options.preferDirectoryIndex) {
                // it shouldn't use extension anyway
                return normalized;
            }
        }

        if (!this.options.preferExtension) {
            return normalized;
        }

        const importExtension = this.options.extensionAlias[resolvedExtension] ?? resolvedExtension;
        return addExtension(normalized, importExtension);
    }

    private isSafeRewrite(input: ResolveInput, originalResolvedFile: string, nextSpecifier: string): boolean {
        const directNextResolved = this.resolver.resolve(buildNextResolveInput(input, nextSpecifier));
        return directNextResolved?.resolvedFile === originalResolvedFile;
    }
}

export function createExtensionsCore(options: ExtensionsCoreOptions = {}): ExtensionsCore {
    return new ExtensionsCore(options);
}
