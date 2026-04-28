import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

import type { ManualTsConfigEntry } from './resolve.js';
import { createPreferAliasOrRelativeCore } from './rules/prefer-alias-or-relative/index.js';
import {
    buildFixedLiteral,
    getImportEqualsLiteral,
    isRequireCall,
    isStringLiteral,
    parseModulePathFixerSettings,
} from './util.js';

type PreferAliasOrRelativeRuleOptions = {
    alias?: readonly ManualTsConfigEntry[];
    childFolderAliasDepth?: number;
    folderAlias?: 'always' | 'never';
    parentFolderAliasDepth?: number;
};

type Options = [PreferAliasOrRelativeRuleOptions?];

type MessageIds = 'preferAliasOrRelative';

const schema: JSONSchema4 = {
    type: 'object',
    additionalProperties: false,
    properties: {
        folderAlias: { type: 'string', enum: ['always', 'never'] },
        parentFolderAliasDepth: { type: 'integer' },
        childFolderAliasDepth: { type: 'integer' },
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
            description: 'Normalize import specifiers between alias and relative forms.',
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

        const settings = parseModulePathFixerSettings(context.settings);
        const ruleOptions = context.options[0] ?? {};

        const core = createPreferAliasOrRelativeCore({
            preferFolderAlias: (ruleOptions.folderAlias ?? 'always') !== 'never',
            parentFolderAliasDepth: ruleOptions.parentFolderAliasDepth,
            childFolderAliasDepth: ruleOptions.childFolderAliasDepth,
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
