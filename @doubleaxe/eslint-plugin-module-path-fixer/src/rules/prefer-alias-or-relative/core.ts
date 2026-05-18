import * as path from 'node:path/posix';

import { normalizePath } from '../../normalizer.js';
import { createImportResolver, type ResolveInput, type ResolverLike } from '../../resolve.js';
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

function createResolvedFile(resolvedFile: string, importerDir: string) {
    const extension = path.extname(resolvedFile);
    const basename = path.basename(resolvedFile, extension);
    const resolvedDir = path.dirname(resolvedFile);
    const relativeDir = buildRelativePath(importerDir, resolvedDir);

    return {
        resolvedFile,
        importerDir,
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

const SpecifierKind = {
    IndexFile: 0,
    IndexDir: 1,
    IndexDirEndingSlash: 2,
    File: 3,
} as const;

function createInputSpecifier(normalizedSpecifier: string, resolvedFile: ResolvedFile) {
    let extension = path.extname(normalizedSpecifier);
    let basename = path.basename(normalizedSpecifier, extension);
    const haveSegments = normalizedSpecifier.includes('/');
    const isRelative = haveSegments && normalizedSpecifier.startsWith('.');

    let kind: (typeof SpecifierKind)[keyof typeof SpecifierKind] = SpecifierKind.File;
    if (resolvedFile.basename === 'index') {
        // TODO - catch /index/index/index case?
        if (basename === 'index') {
            kind = SpecifierKind.IndexFile;
        } else {
            kind = SpecifierKind.IndexDir;
            if (normalizedSpecifier.endsWith('/')) {
                kind = SpecifierKind.IndexDirEndingSlash;
            }
            basename = '';
            extension = '';
        }
    }

    return {
        path: normalizedSpecifier,
        basename,
        extension,
        filename: basename + extension,
        kind,
        isRelative,
    };
}

type InputSpecifier = ReturnType<typeof createInputSpecifier>;

function buildResultFilePath(resultDir: string, inputSpecifier: InputSpecifier): string {
    switch (inputSpecifier.kind) {
        case SpecifierKind.File:
        case SpecifierKind.IndexFile:
            return path.join(resultDir, inputSpecifier.filename);
        case SpecifierKind.IndexDir:
            return resultDir;
        case SpecifierKind.IndexDirEndingSlash:
            return `${resultDir}/`;
    }
    throw new Error('unreachable');
}

function parseAliasWithStar(pattern: string) {
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
        if (starIndex < 0) return '';
        return search.substring(starIndex, search.length - tailPart.length);
    }

    function buildStar(part: string) {
        if (isMatchAll) return part;
        if (starIndex < 0) return '';
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

type ParsedAlias = ReturnType<typeof parseAliasWithStar>;

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
            manualTsConfigs: options.manualTsConfigs,
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
        const normalizedSpecifier = normalizePath(specifier);
        const resolved = this.resolver.resolve({
            ...input,
            specifier: normalizedSpecifier,
        });
        if (!resolved) {
            return { kind: 'unresolved' };
        }

        const resolvedFile = createResolvedFile(resolved.resolvedFile, resolved.importerDir);
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
        if (!candidate.startsWith('.')) candidate = `./${candidate}`;

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
            const parsedAlias = parseAliasWithStar(aliasMapping.alias);
            for (const aliasTarget of aliasMapping.targets) {
                const parsedAbsoluteTarget = parseAliasWithStar(aliasTarget.absolutePattern);
                const aliasCandidate = this.checkAliasCandidate(
                    parsedAlias,
                    parsedAbsoluteTarget,
                    aliasTarget.originalPattern,
                    aliasTarget.baseDir,
                    inputSpecifier,
                    resolvedFile
                );

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
        absoluteTarget: ParsedAlias,
        relativeTarget: string,
        targetBaseDir: string,
        inputSpecifier: InputSpecifier,
        resolvedFile: ResolvedFile
    ) {
        let matchedFile = resolvedFile.resolvedFile;
        if (!absoluteTarget.matchStar(resolvedFile.resolvedFile)) {
            if (absoluteTarget.isHaveStar) {
                // try extension alias
                const extensionAlias = this.options.extensionAlias[resolvedFile.extension];
                if (!extensionAlias) {
                    return undefined;
                }
                matchedFile = resolvedFile.resolvedDir + resolvedFile.basename + extensionAlias;
                if (!absoluteTarget.matchStar(matchedFile)) {
                    return undefined;
                }
            } else {
                // try direct import file name as is
                matchedFile = buildResultFilePath(resolvedFile.resolvedDir, inputSpecifier);
                if (!absoluteTarget.matchStar(matchedFile)) {
                    return undefined;
                }
            }
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
        if (!normalizedTarget.startsWith('.')) {
            normalizedTarget = `./${normalizedTarget}`;
        }
        const parsedTarget = parseAliasWithStar(normalizedTarget);
        if (!parsedTarget.matchStar(relativePath)) {
            return undefined;
        }

        let aliasChildNode = parsedTarget.cutStar(relativePath);

        if (alias.haveTail) {
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
