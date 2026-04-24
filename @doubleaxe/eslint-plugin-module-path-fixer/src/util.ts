import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import type { ManualTsConfigEntry } from './resolve.js';

export type ModulePathFixerSettings = {
    alias?: readonly ManualTsConfigEntry[];
    caseInsensitive?: boolean;
    extensions?: readonly string[];
    usePackageJson?: boolean;
    useTsConfig?: boolean;
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

    const alias = Array.isArray(namespace['alias'])
        ? (namespace['alias'] as readonly ManualTsConfigEntry[])
        : undefined;
    const extensions = Array.isArray(namespace['extensions'])
        ? (namespace['extensions'] as readonly string[])
        : undefined;
    const caseInsensitive =
        typeof namespace['caseInsensitive'] === 'boolean' ? namespace['caseInsensitive'] : undefined;
    const usePackageJson = typeof namespace['usePackageJson'] === 'boolean' ? namespace['usePackageJson'] : undefined;
    const useTsConfig = typeof namespace['useTsConfig'] === 'boolean' ? namespace['useTsConfig'] : undefined;

    return {
        alias,
        extensions,
        caseInsensitive,
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
