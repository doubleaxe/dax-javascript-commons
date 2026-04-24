import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import type { JSONSchema4 } from '@typescript-eslint/utils/json-schema';

import type { ManualTsConfigEntry } from './resolve.js';
import type { ExtensionsMode } from './rules/extensions/index.js';
import { createExtensionsCore } from './rules/extensions/index.js';
import {
    buildFixedLiteral,
    getImportEqualsLiteral,
    isRequireCall,
    isStringLiteral,
    parseModulePathFixerSettings,
} from './util.js';

type ExtensionsRuleOptions = {
    alias?: readonly ManualTsConfigEntry[];
    extension?: ExtensionsMode;
    extensionMapping?: Readonly<Record<string, string>>;
    index?: ExtensionsMode;
};

type Options = [ExtensionsRuleOptions?];

type MessageIds = 'extensions';

function isMode(value: unknown): value is ExtensionsMode {
    return value === 'always' || value === 'never';
}

const schema: JSONSchema4 = {
    type: 'object',
    additionalProperties: false,
    required: ['extension', 'index'],
    properties: {
        extension: {
            type: 'string',
            enum: ['always', 'never'],
        },
        index: {
            type: 'string',
            enum: ['always', 'never'],
        },
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
        extensionMapping: {
            type: 'object',
            additionalProperties: { type: 'string' },
        },
    },
};

export const extensionsRule: TSESLint.RuleModule<MessageIds, Options> = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Resolve import targets and enforce configured extension and directory index specifier style.',
        },
        fixable: 'code',
        schema: [schema],
        messages: {
            extensions: 'Prefer "{{nextSpecifier}}" instead of "{{currentSpecifier}}".',
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

        if (!isMode(ruleOptions.extension) || !isMode(ruleOptions.index)) {
            return {};
        }

        const core = createExtensionsCore({
            extension: ruleOptions.extension,
            index: ruleOptions.index,
            extensionMapping: ruleOptions.extensionMapping,
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
                messageId: 'extensions',
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

export default extensionsRule;
