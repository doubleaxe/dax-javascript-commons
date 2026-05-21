import type { ManualAliasEntry, ResolvedSpecifierKindType, SpecifierClassType } from '../types.js';
import type { ParsedAlias } from './utils.js';

export type AliasEntry = {
    source: 'manual' | 'package' | 'tsconfig';
} & ManualAliasEntry;

export type AliasCacheEntry = {
    alias: AbsolutePathAliasArray;
    path: string;
};

export type AbsolutePathAliasTarget = {
    absolutePattern: string;
    baseDir: string;
    originalPattern: string;
    parsedAbsolutePattern: ParsedAlias;
    parsedOriginalPattern: ParsedAlias;
};
export type AbsolutePathAliasArray = { alias: string; parsedAlias: ParsedAlias; targets: AbsolutePathAliasTarget[] }[];

export type PackageJsonContent = {
    [key: string]: unknown;
    imports?: Record<string, unknown>;
};

export type TsConfigContent = {
    [key: string]: unknown;
    compilerOptions?: {
        absoluteBaseUrl?: string;
        baseUrl?: string;
        paths?: Record<string, string[]>;
        strict?: boolean;
    };
    extends?: string | string[];
};

export type ResolvedPath = {
    path: string;
    specifierKind: ResolvedSpecifierKindType;
};

export type ResolvedAlias = {
    specifierClass: SpecifierClassType;
} & ResolvedPath;
