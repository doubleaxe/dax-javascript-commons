import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

import type { ManualTsConfigEntry } from './resolve.js';
import { createPreferAliasOrRelativeCore } from './rules/prefer-alias-or-relative/index.js';

type ModulePathFixerSettings = {
    alias?: readonly ManualTsConfigEntry[];
    caseInsensitive?: boolean;
    extensions?: readonly string[];
    usePackageJson?: boolean;
    useTsConfig?: boolean;
};

type PreferAliasOrRelativeRuleOptions = {
    alias?: readonly ManualTsConfigEntry[];
    depth?: number;
};

type Options = [PreferAliasOrRelativeRuleOptions?];

type MessageIds = 'preferAliasOrRelative';

function isStringLiteral(node: null | TSESTree.Node | undefined): node is TSESTree.Literal {
    return node?.type === AST_NODE_TYPES.Literal && typeof node.value === 'string';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function parseSettings(context: TSESLint.RuleContext<MessageIds, Options>): ModulePathFixerSettings {
    const settings = asRecord(context.settings);
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

function detectQuote(raw: string | undefined): '"' | "'" {
    if (!raw) {
        return "'";
    }

    if (raw.startsWith('"')) {
        return '"';
    }

    return "'";
}

function escapeSpecifier(value: string, quote: '"' | "'"): string {
    return value.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`);
}

function buildFixedLiteral(nextSpecifier: string, raw: string | undefined): string {
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

function isRequireCall(node: TSESTree.CallExpression, sourceCode: Readonly<TSESLint.SourceCode>): boolean {
    if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== 'require' || node.arguments.length !== 1) {
        return false;
    }

    return isGlobalRequireIdentifier(sourceCode, node.callee);
}

function getImportEqualsLiteral(node: TSESTree.TSImportEqualsDeclaration): null | TSESTree.Literal {
    const moduleReference = node.moduleReference;
    if (moduleReference.type !== AST_NODE_TYPES.TSExternalModuleReference) {
        return null;
    }

    return isStringLiteral(moduleReference.expression) ? moduleReference.expression : null;
}

const schema: JSONSchema4 = {
    type: 'object',
    additionalProperties: false,
    properties: {
        depth: { type: 'integer' },
        alias: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['baseUrl', 'paths'],
                properties: {
                    baseUrl: { type: 'string' },
                    paths: {
                        type: 'object',
                        additionalProperties: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                    },
                },
            },
        },
    },
};

export const preferAliasOrRelativeRule: TSESLint.RuleModule<MessageIds, Options> = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Normalize import specifiers between alias and relative forms by traversal depth.',
        },
        fixable: 'code',
        schema: [schema],
        messages: {
            preferAliasOrRelative: 'Prefer "{{nextSpecifier}}" instead of "{{currentSpecifier}}".',
        },
    },
    defaultOptions: [{}],
    create(context) {
        const filename = context.filename;
        if (!filename || filename === '<input>' || filename === '<text>') {
            return {};
        }

        const settings = parseSettings(context);
        const ruleOptions = context.options[0] ?? {};

        const core = createPreferAliasOrRelativeCore({
            depth: ruleOptions.depth,
            manualTsConfigs: ruleOptions.alias ?? settings.alias,
            extensions: settings.extensions,
            caseInsensitive: settings.caseInsensitive,
            usePackageJson: settings.usePackageJson,
            useTsConfig: settings.useTsConfig,
        });

        function reportSpecifier(literalNode: TSESTree.Literal): void {
            if (typeof literalNode.value !== 'string') {
                return;
            }

            const currentSpecifier = literalNode.value;
            const decision = core.evaluate({
                importerFile: filename,
                specifier: currentSpecifier,
            });

            if (!decision || decision.nextSpecifier === currentSpecifier || !literalNode.range) {
                return;
            }

            context.report({
                node: literalNode,
                messageId: 'preferAliasOrRelative',
                data: {
                    currentSpecifier,
                    nextSpecifier: decision.nextSpecifier,
                },
                fix: (fixer) =>
                    fixer.replaceTextRange(
                        literalNode.range,
                        buildFixedLiteral(decision.nextSpecifier, literalNode.raw)
                    ),
            });
        }

        return {
            ImportDeclaration(node): void {
                if (isStringLiteral(node.source)) {
                    reportSpecifier(node.source);
                }
            },
            ExportNamedDeclaration(node): void {
                if (isStringLiteral(node.source)) {
                    reportSpecifier(node.source);
                }
            },
            ExportAllDeclaration(node): void {
                if (isStringLiteral(node.source)) {
                    reportSpecifier(node.source);
                }
            },
            ImportExpression(node): void {
                if (isStringLiteral(node.source)) {
                    reportSpecifier(node.source);
                }
            },
            CallExpression(node): void {
                if (!isRequireCall(node, context.sourceCode)) {
                    return;
                }

                const firstArg = node.arguments[0];
                if (firstArg && isStringLiteral(firstArg)) {
                    reportSpecifier(firstArg);
                }
            },
            TSImportEqualsDeclaration(node): void {
                const literal = getImportEqualsLiteral(node);
                if (literal) {
                    reportSpecifier(literal);
                }
            },
        };
    },
};

export default preferAliasOrRelativeRule;
