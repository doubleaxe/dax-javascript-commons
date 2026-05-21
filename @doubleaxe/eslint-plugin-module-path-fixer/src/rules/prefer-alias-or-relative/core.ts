import * as path from 'node:path/posix';

import type { AbsolutePathAliasTarget } from '../../alias/types.js';
import { parseAliasWithStar, type ParsedAlias } from '../../alias/utils.js';
import { normalizePath } from '../../normalizer.js';
import { createImportResolver, type ResolvedImport, type ResolveInput, type ResolverLike } from '../../resolve.js';
import { ResolvedSpecifierKind } from '../../types.js';
import type {
    DecisionKind,
    PreferAliasOrRelativeCoreOptions,
    PreferAliasOrRelativeDecision,
    SpecifierReason,
} from './types.js';

type NormalizedCoreOptions = {
    extensionAlias: Readonly<Record<string, string>>;
    maxChildFolderSegments: number;
    maxParentSegments: number;
    optimization: 'none' | 'shorter' | 'shorterEqual';
    useTotalParentSegments: boolean;
};

function buildRelativePath(from: string, to: string) {
    let relativePath = path.relative(from, to);
    if (!relativePath.startsWith('.')) {
        relativePath = `./${relativePath}`;
    }
    return relativePath;
}

function createResolvedFile(resolved: ResolvedImport) {
    const { resolvedFile, importerDir } = resolved;
    const extension = path.extname(resolvedFile);
    const basename = path.basename(resolvedFile, extension);
    const resolvedDir = path.dirname(resolvedFile);
    const relativeDir = buildRelativePath(importerDir, resolvedDir);

    return {
        ...resolved,
        basename,
        extension,
        resolvedDir,
        relativeDir,
        ...getPathDepth(relativeDir),
    };
}

type ResolvedFile = ReturnType<typeof createResolvedFile>;

function getPathDepth(fillePath: string) {
    const segments = fillePath.split('/');
    let parentSegments = 0;
    let folderSegments = 0;

    for (const segment of segments) {
        if (segment === '') {
            continue;
        }

        if (segment === '..') {
            parentSegments++;
        } else {
            // '.' is also dir
            folderSegments++;
        }
    }

    return { parentSegments, folderSegments, totalSegments: parentSegments + folderSegments };
}

type PathDepth = ReturnType<typeof getPathDepth>;

function createInputSpecifier(normalizedSpecifier: string, resolvedFile: ResolvedFile) {
    let extension = path.extname(normalizedSpecifier);
    let basename = path.basename(normalizedSpecifier, extension);
    const haveSegments = normalizedSpecifier.includes('/');
    const isRelative = haveSegments && normalizedSpecifier.startsWith('.');

    if (resolvedFile.specifierKind === 'IndexDir') {
        basename = '';
        extension = '';
    }

    return {
        path: normalizedSpecifier,
        basename,
        extension,
        filename: basename + extension,
        kind: resolvedFile.specifierKind,
        isRelative,
    };
}

type InputSpecifier = ReturnType<typeof createInputSpecifier>;

function buildResultFilePath(resultDir: string, inputSpecifier: InputSpecifier): string {
    switch (inputSpecifier.kind) {
        case ResolvedSpecifierKind.IndexDir:
            return resultDir;
        default:
            return path.join(resultDir, inputSpecifier.filename);
    }
    throw new Error('unreachable');
}

type AliasInfo = { alias?: { alias: string } & PathDepth; reason: SpecifierReason };
type ResultType = {
    aliasReason?: SpecifierReason;
    converted?: string;
    kind: DecisionKind;
    relativeReason?: SpecifierReason;
};

export class PreferAliasOrRelativeCore {
    private readonly options: NormalizedCoreOptions;
    private readonly resolver: ResolverLike;

    public constructor(options: PreferAliasOrRelativeCoreOptions = {}) {
        this.resolver = createImportResolver({
            extensions: options.extensions,
            extensionAlias: options.extensionAlias,
            resolveCacheTtl: options.resolveCacheTtl,
            usePackageJson: options.usePackageJson,
            useTsConfig: options.useTsConfig,
            manualAliases: options.manualAliases,
        });

        this.options = {
            maxChildFolderSegments: options.maxChildFolderSegments ?? -1,
            maxParentSegments: options.maxParentSegments ?? 1,
            optimization: options.optimization ?? 'shorterEqual',
            useTotalParentSegments: options.useTotalParentSegments ?? false,
            extensionAlias: this.resolver.getExtensionAliases(),
        };
    }

    public evaluate(input: ResolveInput): PreferAliasOrRelativeDecision {
        const specifier = input.specifier;
        let normalizedSpecifier = normalizePath(specifier);
        if (normalizedSpecifier.endsWith('/')) {
            // normalize ending slash to prevent ambigous resolutions
            normalizedSpecifier = normalizedSpecifier.slice(0, -1);
        }
        const resolved = this.resolver.resolve({
            ...input,
            specifier: normalizedSpecifier,
        });
        if (!resolved) {
            return { kind: 'unresolved' };
        }

        const resolvedFile = createResolvedFile(resolved);
        const inputSpecifier = createInputSpecifier(normalizedSpecifier, resolvedFile);

        let converted: ResultType;
        if (this.options.optimization === 'none') {
            converted = this.tryChooseAliasBasedOnDepth(inputSpecifier, resolvedFile);
        } else {
            converted = this.tryChooseAliasOptimized(inputSpecifier, resolvedFile);
        }

        const nextSpecifier = converted.converted === input.specifier ? undefined : converted.converted;
        return {
            kind: converted.kind,
            aliasReason: converted.aliasReason,
            relativeReason: converted.relativeReason,
            nextSpecifier,
            resolved,
        };
    }

    private tryChooseAliasBasedOnDepth(
        inputSpecifier: InputSpecifier,
        resolvedFile: ResolvedFile,
        aliasInfo?: AliasInfo
    ): ResultType {
        let useAlias = false;
        const { maxChildFolderSegments, maxParentSegments, useTotalParentSegments } = this.options;
        const isParentPath = resolvedFile.parentSegments > 0;

        if (isParentPath) {
            if (maxParentSegments < 0) {
                useAlias = false;
            } else if (maxParentSegments === 0) {
                useAlias = true;
            } else {
                useAlias =
                    (useTotalParentSegments ? resolvedFile.totalSegments : resolvedFile.parentSegments) >
                    maxParentSegments;
            }
        } else {
            if (maxChildFolderSegments < 0) {
                useAlias = false;
            } else if (maxChildFolderSegments === 0) {
                useAlias = true;
            } else {
                useAlias = resolvedFile.folderSegments > maxChildFolderSegments;
            }
        }

        let _aliasInfo = aliasInfo;
        if (useAlias) {
            _aliasInfo ??= this.tryFindAlias(inputSpecifier, resolvedFile);
            if (_aliasInfo.alias) {
                return {
                    converted: _aliasInfo.alias.alias,
                    kind: 'alias-depth',
                    aliasReason: _aliasInfo.reason,
                };
            }
        }

        return this.buildRelativeResult(inputSpecifier, resolvedFile, _aliasInfo?.reason);
    }

    private tryChooseAliasOptimized(inputSpecifier: InputSpecifier, resolvedFile: ResolvedFile): ResultType {
        const aliasInfo = this.tryFindAlias(inputSpecifier, resolvedFile);
        const { alias, reason: aliasReason } = aliasInfo;
        if (!alias) {
            return this.buildRelativeResult(inputSpecifier, resolvedFile, aliasReason);
        }

        const _resolvedAlias = alias.alias;
        // alias segments include file name
        const aliasSegments = alias.totalSegments - 1;
        const relativeSegments = resolvedFile.totalSegments;

        if (this.options.optimization === 'shorter') {
            if (aliasSegments < relativeSegments) {
                return {
                    converted: _resolvedAlias,
                    kind: 'alias-optimized',
                    aliasReason,
                };
            }
        } else if (this.options.optimization === 'shorterEqual') {
            if (aliasSegments <= relativeSegments) {
                return {
                    converted: _resolvedAlias,
                    kind: 'alias-optimized',
                    aliasReason,
                };
            }
        }

        return this.tryChooseAliasBasedOnDepth(inputSpecifier, resolvedFile, aliasInfo);
    }

    private buildRelativeResult(
        inputSpecifier: InputSpecifier,
        resolvedFile: ResolvedFile,
        aliasReason?: SpecifierReason
    ): ResultType {
        let candidate = buildResultFilePath(resolvedFile.relativeDir, inputSpecifier);
        if (!path.posix.isAbsolute(candidate) && !path.win32.isAbsolute(candidate)) {
            if (!candidate.startsWith('.')) candidate = `./${candidate}`;
        }

        const candidateValidation = this.resolver.resolve({
            importerDir: resolvedFile.importerDir,
            specifier: candidate,
        });
        if (candidateValidation?.resolvedFile !== resolvedFile.resolvedFile) {
            return {
                kind: 'relative',
                relativeReason: 'unsafe',
                aliasReason,
            };
        }

        return {
            converted: candidate,
            kind: 'relative',
            relativeReason: 'found',
            aliasReason,
        };
    }

    private tryFindAlias(inputSpecifier: InputSpecifier, resolvedFile: ResolvedFile): AliasInfo {
        const candidateAliases: string[] = [];
        const aliasMappings = this.resolver.getAliasMappings(resolvedFile.importerDir);

        for (const aliasMapping of aliasMappings) {
            const parsedAlias = aliasMapping.parsedAlias;
            for (const aliasTarget of aliasMapping.targets) {
                const aliasCandidate = this.checkAliasCandidate(parsedAlias, aliasTarget, inputSpecifier, resolvedFile);

                if (aliasCandidate) {
                    candidateAliases.push(aliasCandidate);
                }
            }
        }

        if (!candidateAliases.length) {
            return { reason: 'unresolved' };
        }

        const result = candidateAliases
            .map((alias) => {
                return {
                    alias,
                    ...getPathDepth(alias),
                };
            })
            .sort((a, b) => {
                return a.totalSegments - b.totalSegments;
            });

        const validResult = result.find((candidate) => {
            const candidateValidation = this.resolver.resolve({
                importerDir: resolvedFile.importerDir,
                specifier: candidate.alias,
            });
            return candidateValidation?.resolvedFile === resolvedFile.resolvedFile;
        });

        if (!validResult) {
            return { reason: 'unsafe' };
        }
        return { alias: validResult, reason: 'found' };
    }

    private checkAliasCandidate(
        alias: ParsedAlias,
        aliasTarget: AbsolutePathAliasTarget,
        inputSpecifier: InputSpecifier,
        resolvedFile: ResolvedFile
    ) {
        const {
            parsedAbsolutePattern: absoluteTarget,
            originalPattern: relativeTarget,
            baseDir: targetBaseDir,
        } = aliasTarget;

        let matchedFile = resolvedFile.resolvedFile;
        let foundMatch = absoluteTarget.matchStar(matchedFile);
        if (!foundMatch) {
            // try extension alias
            const extensionAlias = this.options.extensionAlias[resolvedFile.extension];
            if (extensionAlias) {
                matchedFile = resolvedFile.resolvedDir + resolvedFile.basename + extensionAlias;
                foundMatch = absoluteTarget.matchStar(matchedFile);
            }
        }
        if (!foundMatch) {
            // try extensionless
            matchedFile = resolvedFile.resolvedDir + resolvedFile.basename;
            foundMatch = absoluteTarget.matchStar(matchedFile);
        }
        if (!foundMatch) {
            // try direct import file name as is
            matchedFile = buildResultFilePath(resolvedFile.resolvedDir, inputSpecifier);
            foundMatch = absoluteTarget.matchStar(matchedFile);
        }
        if (!foundMatch) {
            return undefined;
        }

        // this is alias candidate
        if (!alias.isHaveStar) {
            return alias.pattern;
        }

        const relativePath = buildRelativePath(targetBaseDir, matchedFile);
        // should handle all extreme cases
        // '*': ['*', './*', './*.js', './src/*', './src/basename*.js', '../parent/*']
        // '@/*', '#/*', '@*', '#*', 'header*', '@/*.js'
        // we also cannot normalize alias, so '@\\*' is different
        // also '@/src' pointing to index file
        let normalizedTarget = normalizePath(relativeTarget);
        if (!path.posix.isAbsolute(normalizedTarget) && !path.win32.isAbsolute(normalizedTarget)) {
            if (!normalizedTarget.startsWith('.')) {
                normalizedTarget = `./${normalizedTarget}`;
            }
        }
        const parsedTarget = parseAliasWithStar(normalizedTarget);
        if (!parsedTarget.matchStar(relativePath)) {
            return undefined;
        }

        let aliasChildNode = parsedTarget.cutStar(relativePath);

        if (alias.haveTail || parsedTarget.haveTail) {
            return alias.buildStar(aliasChildNode);
        }

        // if tail is open - we can change it to match original style
        // alias child is always normalized
        // will be empty sting for just file name
        let candidateDir = path.dirname(aliasChildNode);
        if (candidateDir === '.') candidateDir = '';
        aliasChildNode = buildResultFilePath(candidateDir, inputSpecifier);

        return alias.buildStar(aliasChildNode);
    }
}

export function createPreferAliasOrRelativeCore(
    options: PreferAliasOrRelativeCoreOptions = {}
): PreferAliasOrRelativeCore {
    return new PreferAliasOrRelativeCore(options);
}
