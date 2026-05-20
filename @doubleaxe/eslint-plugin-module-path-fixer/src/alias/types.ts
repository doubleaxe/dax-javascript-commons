export type AliasEntry = {
    baseUrl: string;
    paths: Readonly<Record<string, readonly string[]>>;
    source: 'manual' | 'package' | 'tsconfig';
};

export type AliasCacheEntry = {
    alias: AbsolutePathAliasArray;
    path: string;
};

export type AbsolutePathAliasTarget = { absolutePattern: string; baseDir: string; originalPattern: string };
export type AbsolutePathAliasArray = { alias: string; targets: AbsolutePathAliasTarget[] }[];

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
