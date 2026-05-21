export type ReverseExtensionAlias = Record<string, string[]>;

export type ManualAliasEntry = {
    baseUrl: string;
    paths: Readonly<Record<string, readonly string[]>>;
};

export const SpecifierClass = {
    Relative: 'Relative',
    Absolute: 'Absolute',
    StaticAlias: 'StaticAlias',
    StarAlias: 'StarAlias',
    StarAliasWithTail: 'StarAliasWithTail',
} as const;

export type SpecifierClassType = (typeof SpecifierClass)[keyof typeof SpecifierClass];

export const ResolvedSpecifierKind = {
    FileWithoutExtension: 'FileWithoutExtension',
    FileWithExtension: 'FileWithExtension',
    FileWithExtensionAlias: 'FileWithExtensionAlias',
    IndexDir: 'IndexDir',
} as const;

export type ResolvedSpecifierKindType = (typeof ResolvedSpecifierKind)[keyof typeof ResolvedSpecifierKind];
