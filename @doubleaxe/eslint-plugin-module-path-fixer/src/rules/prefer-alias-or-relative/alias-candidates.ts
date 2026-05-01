import * as path from 'node:path';

import type { ManualTsConfigEntry, PackageJsonContent, ResolvedImport } from '../../resolve.js';
import { isTsConfigSuccess } from '../../resolve.js';

type AliasCandidatesOptions = {
    manualTsConfigs?: readonly ManualTsConfigEntry[];
};

function toPosixPath(value: string): string {
    return value.split(path.sep).join('/');
}

function normalizeMappedPath(value: string): string {
    let normalized = toPosixPath(value).replace(/\\/g, '/');
    if (normalized.startsWith('./')) {
        normalized = normalized.slice(2);
    }

    return normalized;
}

function removeExtension(value: string): string {
    const extension = path.extname(value);
    if (!extension) {
        return value;
    }

    return value.slice(0, -extension.length);
}

function unique(values: readonly string[]): string[] {
    return [...new Set(values)];
}

function buildTargetSubpaths(baseDir: string, resolvedFile: string): string[] {
    const relativeToBase = path.relative(baseDir, resolvedFile);
    if (!relativeToBase || relativeToBase.startsWith('..') || path.isAbsolute(relativeToBase)) {
        return [];
    }

    const posixWithExt = normalizeMappedPath(relativeToBase);
    const posixWithoutExt = removeExtension(posixWithExt);
    const subpaths = [posixWithExt, posixWithoutExt];

    if (posixWithoutExt.endsWith('/index')) {
        const withoutIndex = posixWithoutExt.slice(0, -'/index'.length);
        if (withoutIndex.length > 0) {
            subpaths.push(withoutIndex);
        }
    }

    return unique(subpaths);
}

function buildPackageImportSubpaths(baseDir: string, resolvedFile: string): string[] {
    const relativeToBase = path.relative(baseDir, resolvedFile);
    if (!relativeToBase || relativeToBase.startsWith('..') || path.isAbsolute(relativeToBase)) {
        return [];
    }

    return [normalizeMappedPath(relativeToBase)];
}

function extractWildcardValue(pattern: string, value: string): null | string {
    const wildcardIndex = pattern.indexOf('*');
    if (wildcardIndex < 0) {
        return pattern === value ? '' : null;
    }

    const prefix = pattern.slice(0, wildcardIndex);
    const suffix = pattern.slice(wildcardIndex + 1);

    if (!value.startsWith(prefix) || !value.endsWith(suffix)) {
        return null;
    }

    return value.slice(prefix.length, value.length - suffix.length);
}

function applyWildcard(pattern: string, wildcardValue: string): string {
    const wildcardIndex = pattern.indexOf('*');
    if (wildcardIndex < 0) {
        return pattern;
    }

    return `${pattern.slice(0, wildcardIndex)}${wildcardValue}${pattern.slice(wildcardIndex + 1)}`;
}

function mapSubpathToAlias(pattern: string, mappedTarget: string, subpath: string): null | string {
    const wildcardValue = extractWildcardValue(mappedTarget, subpath);
    if (wildcardValue === null) {
        return null;
    }

    return applyWildcard(pattern, wildcardValue);
}

function collectFromPathMappings(
    baseDir: string,
    paths: Readonly<Record<string, readonly string[]>>,
    resolvedFile: string
): string[] {
    const subpaths = buildTargetSubpaths(baseDir, resolvedFile);
    if (subpaths.length === 0) {
        return [];
    }

    const candidates: string[] = [];

    for (const [pattern, mappedTargets] of Object.entries(paths)) {
        for (const mappedTarget of mappedTargets) {
            const normalizedTarget = normalizeMappedPath(mappedTarget);
            for (const subpath of subpaths) {
                const candidate = mapSubpathToAlias(pattern, normalizedTarget, subpath);
                if (!candidate || candidate.startsWith('.') || candidate.startsWith('/')) {
                    continue;
                }

                candidates.push(candidate);
            }
        }
    }

    return unique(candidates);
}

function collectImportTargets(value: unknown): string[] {
    if (typeof value === 'string') {
        return [value];
    }

    if (Array.isArray(value)) {
        return unique(value.flatMap((entry) => collectImportTargets(entry)));
    }

    if (value && typeof value === 'object') {
        return unique(Object.values(value as Record<string, unknown>).flatMap((entry) => collectImportTargets(entry)));
    }

    return [];
}

function collectFromPackageImports(
    packageJsonPath: string,
    content: PackageJsonContent,
    resolvedFile: string
): string[] {
    if (!content.imports || typeof content.imports !== 'object') {
        return [];
    }

    const packageRoot = path.dirname(packageJsonPath);
    const subpaths = buildPackageImportSubpaths(packageRoot, resolvedFile);
    if (subpaths.length === 0) {
        return [];
    }

    const candidates: string[] = [];
    for (const [specifierPattern, targetConfig] of Object.entries(content.imports)) {
        if (!specifierPattern.startsWith('#')) {
            continue;
        }

        const targets = collectImportTargets(targetConfig).map(normalizeMappedPath);
        for (const targetPattern of targets) {
            for (const subpath of subpaths) {
                const candidate = mapSubpathToAlias(specifierPattern, targetPattern, subpath);
                if (candidate) {
                    candidates.push(candidate);
                }
            }
        }
    }

    return unique(candidates);
}

export function collectAliasCandidatesForResolvedImport(
    resolved: ResolvedImport,
    options: AliasCandidatesOptions = {}
): string[] {
    const candidates: string[] = [];

    if (resolved.tsJsConfig && isTsConfigSuccess(resolved.tsJsConfig.config)) {
        candidates.push(
            ...collectFromPathMappings(
                resolved.tsJsConfig.config.absoluteBaseUrl,
                resolved.tsJsConfig.config.paths,
                resolved.resolvedFile
            )
        );
    }

    for (const manual of options.manualTsConfigs ?? []) {
        const baseDir = path.isAbsolute(manual.baseUrl)
            ? path.normalize(manual.baseUrl)
            : path.normalize(path.resolve(process.cwd(), manual.baseUrl));
        candidates.push(...collectFromPathMappings(baseDir, manual.paths, resolved.resolvedFile));
    }

    if (resolved.packageJson) {
        candidates.push(
            ...collectFromPackageImports(resolved.packageJson.path, resolved.packageJson.content, resolved.resolvedFile)
        );
    }

    return unique(candidates);
}
