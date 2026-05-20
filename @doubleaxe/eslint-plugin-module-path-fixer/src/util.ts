import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import type { AliasEntry } from './alias/types.js';
import type { ResolveInput } from './resolve.js';

export type ModulePathFixerSettings = {
    alias?: readonly AliasEntry[];
    extensionAlias?: Readonly<Record<string, string>>;
    extensions?: readonly string[];
    resolveCacheTtl?: number;
    usePackageJson?: boolean | readonly string[] | string;
    useTsConfig?: boolean | readonly string[] | string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

export function parseModulePathFixerSettings(settingsInput: unknown): ModulePathFixerSettings {
    const settings = asRecord(settingsInput);
    const namespace = asRecord(settings?.['module-path-fixer']);
    if (!namespace) {
        return {};
    }

    const alias = Array.isArray(namespace['alias']) ? (namespace['alias'] as readonly AliasEntry[]) : undefined;
    const extensionAliasRecord = asRecord(namespace['extensionAlias']);
    const extensionAlias = extensionAliasRecord
        ? (Object.fromEntries(
              Object.entries(extensionAliasRecord).filter((entry): entry is [string, string] => {
                  const [sourceExtension, targetExtension] = entry;
                  return sourceExtension.length > 0 && typeof targetExtension === 'string';
              })
          ) as Readonly<Record<string, string>>)
        : undefined;
    const extensions = Array.isArray(namespace['extensions'])
        ? (namespace['extensions'] as readonly string[])
        : undefined;
    const resolveCacheTtl = typeof namespace['resolveCacheTtl'] === 'number' ? namespace['resolveCacheTtl'] : undefined;
    const usePackageJson =
        typeof namespace['usePackageJson'] === 'boolean' ||
        typeof namespace['usePackageJson'] === 'string' ||
        Array.isArray(namespace['usePackageJson'])
            ? namespace['usePackageJson']
            : undefined;
    const useTsConfig =
        typeof namespace['useTsConfig'] === 'boolean' ||
        typeof namespace['useTsConfig'] === 'string' ||
        Array.isArray(namespace['useTsConfig'])
            ? namespace['useTsConfig']
            : undefined;

    return {
        alias,
        extensionAlias,
        extensions,
        resolveCacheTtl,
        usePackageJson,
        useTsConfig,
    };
}

export function isStringLiteral(node: null | TSESTree.Node | undefined): node is TSESTree.Literal {
    return node?.type === AST_NODE_TYPES.Literal && typeof node.value === 'string';
}

export function detectQuote(raw: string | undefined): '"' | "'" {
    if (!raw) {
        return "'";
    }

    if (raw.startsWith('"')) {
        return '"';
    }

    return "'";
}

export function escapeSpecifier(value: string, quote: '"' | "'"): string {
    return value.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`);
}

export function buildFixedLiteral(nextSpecifier: string, raw: string | undefined): string {
    const quote = detectQuote(raw);
    return `${quote}${escapeSpecifier(nextSpecifier, quote)}${quote}`;
}

function isGlobalRequireIdentifier(
    sourceCode: Readonly<TSESLint.SourceCode>,
    identifier: TSESTree.Identifier
): boolean {
    const scope = sourceCode.getScope(identifier);
    const reference = scope.references.find((item) => item.identifier === identifier);

    if (!reference?.resolved) {
        return true;
    }

    return reference.resolved.defs.length === 0;
}

export function isRequireCall(node: TSESTree.CallExpression, sourceCode: Readonly<TSESLint.SourceCode>): boolean {
    if (
        node.callee.type !== AST_NODE_TYPES.Identifier ||
        node.callee.name !== 'require' ||
        node.arguments.length !== 1
    ) {
        return false;
    }

    return isGlobalRequireIdentifier(sourceCode, node.callee);
}

export function getImportEqualsLiteral(node: TSESTree.TSImportEqualsDeclaration): null | TSESTree.Literal {
    const moduleReference = node.moduleReference;
    if (moduleReference.type !== AST_NODE_TYPES.TSExternalModuleReference) {
        return null;
    }

    return isStringLiteral(moduleReference.expression) ? moduleReference.expression : null;
}

export function buildResolveInput(importerFile: string, specifier: string): ResolveInput {
    return {
        importerFile,
        specifier,
    };
}

export function buildNextResolveInput(input: ResolveInput, specifier: string): ResolveInput {
    return {
        importerFile: input.importerFile,
        specifier,
    };
}

export function stripBom(text: string): string {
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
