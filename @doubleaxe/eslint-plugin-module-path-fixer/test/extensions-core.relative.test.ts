import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { clearAllCaches } from '../src/resolve.js';
import { createExtensionsCore } from '../src/rules/extensions/index.js';

const tempRoots: string[] = [];
const fixturesRoot = path.resolve(process.cwd(), 'test-assets');

function useLocalProjectFromFixture(fixtureName: string): string {
    const fixturePath = path.join(fixturesRoot, fixtureName);
    return fixturePath;
}

afterEach(() => {
    while (tempRoots.length > 0) {
        const root = tempRoots.pop();
        if (root) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }
    clearAllCaches();
});

describe('ExtensionsCore.relative', () => {
    describe('relative', () => {
        it('extension mode is always', () => {
            const root = useLocalProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');

            let core = createExtensionsCore({
                preferExtension: true,
                preferDirectoryIndex: false,
                extensions: ['.ts', '.js'],
                extensionAlias: { ts: 'js' },
            });

            let result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/value',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/value.js');

            result = core.evaluate({
                importerFile: importer,
                specifier: './relative',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('./relative.js');

            result = core.evaluate({
                importerFile: importer,
                specifier: './relative.ts',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('./relative.js');

            result = core.evaluate({
                importerFile: importer,
                specifier: './relative.js',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: './relative.mjs',
            });
            expect(result.reason).toBe('unresolved');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../utils/../utils/tool',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../utils/../utils/tool.js');

            core = createExtensionsCore({
                preferExtension: true,
                preferDirectoryIndex: false,
                extensions: ['.ts'],
                extensionAlias: {},
            });

            result = core.evaluate({
                importerFile: importer,
                specifier: './relative',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('./relative.ts');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/value',
            });
            expect(result.reason).toBe('unresolved');
        });

        it('extension mode is never', () => {
            const root = useLocalProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');

            let core = createExtensionsCore({
                preferExtension: false,
                preferDirectoryIndex: false,
                extensions: ['.ts', '.js'],
                extensionAlias: { ts: 'js' },
            });

            let result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/value.js',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/value');

            result = core.evaluate({
                importerFile: importer,
                specifier: './relative.js',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('./relative');

            result = core.evaluate({
                importerFile: importer,
                specifier: './relative.ts',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('./relative');

            result = core.evaluate({
                importerFile: importer,
                specifier: './relative',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: './relative.mjs',
            });
            expect(result.reason).toBe('unresolved');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../utils/../utils/tool.js',
            });
            expect(result.reason).toBe('changed');
            expect(result?.nextSpecifier).toBe('../utils/../utils/tool');

            core = createExtensionsCore({
                preferExtension: false,
                preferDirectoryIndex: false,
                extensions: ['.ts'],
                extensionAlias: {},
            });

            result = core.evaluate({
                importerFile: importer,
                specifier: './relative.ts',
            });
            expect(result.reason).toBe('changed');
            expect(result?.nextSpecifier).toBe('./relative');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/value.js',
            });
            expect(result.reason).toBe('unsafe');
        });

        it('index mode is always', () => {
            const root = useLocalProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');

            let core = createExtensionsCore({
                preferExtension: true,
                preferDirectoryIndex: true,
                extensions: ['.ts', '.js'],
                extensionAlias: { ts: 'js' },
            });

            let result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/index.js');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/index.js');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/index.js');

            result = core.evaluate({
                importerFile: importer,
                specifier: '..\\components\\base\\',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('..\\components\\base\\index.js');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.ts',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/index.js');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.js',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.mjs',
            });
            expect(result.reason).toBe('unresolved');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../utils',
            });
            expect(result.reason).toBe('unresolved');

            core = createExtensionsCore({
                preferExtension: false,
                preferDirectoryIndex: true,
                extensions: ['.ts', '.js'],
                extensionAlias: { ts: 'js' },
            });

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/index');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.ts',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/index');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.js',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/index');

            core = createExtensionsCore({
                preferExtension: true,
                preferDirectoryIndex: true,
                extensions: ['.ts'],
                extensionAlias: {},
            });

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/index.ts');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base/index.ts');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.ts',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.js',
            });
            expect(result.reason).toBe('unresolved');
        });

        it('index mode is never', () => {
            const root = useLocalProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');

            let core = createExtensionsCore({
                preferExtension: true,
                preferDirectoryIndex: false,
                extensions: ['.ts', '.js'],
                extensionAlias: { ts: 'js' },
            });

            let result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: '..\\components\\base\\',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.ts',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.js',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.mjs',
            });
            expect(result.reason).toBe('unresolved');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../utils',
            });
            expect(result.reason).toBe('unresolved');

            core = createExtensionsCore({
                preferExtension: false,
                preferDirectoryIndex: false,
                extensions: ['.ts', '.js'],
                extensionAlias: { ts: 'js' },
            });

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.ts',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.js',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base');

            core = createExtensionsCore({
                preferExtension: true,
                preferDirectoryIndex: false,
                extensions: ['.ts'],
                extensionAlias: {},
            });

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.ts',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/base');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/base/index.js',
            });
            expect(result.reason).toBe('unresolved');
        });

        it('skips ambigous index files', () => {
            const root = useLocalProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');

            let core = createExtensionsCore({
                preferExtension: true,
                preferDirectoryIndex: true,
                extensions: ['.ts', '.js'],
                extensionAlias: { ts: 'js' },
            });

            let result = core.evaluate({
                importerFile: importer,
                specifier: '../components/ext',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/ext.js');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/ext/',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/ext/index.js');

            core = createExtensionsCore({
                preferExtension: false,
                preferDirectoryIndex: false,
                extensions: ['.ts', '.js'],
                extensionAlias: { ts: 'js' },
            });

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/ext',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/ext/',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/ext/index',
            });
            expect(result.reason).toBe('unsafe');

            core = createExtensionsCore({
                preferExtension: true,
                preferDirectoryIndex: false,
                extensions: ['.ts', '.js'],
                extensionAlias: { ts: 'js' },
            });

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/ext',
            });
            expect(result.reason).toBe('changed');
            expect(result.nextSpecifier).toBe('../components/ext.js');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/ext/',
            });
            expect(result.reason).toBe('unchanged');

            result = core.evaluate({
                importerFile: importer,
                specifier: '../components/ext/index.js',
            });
            expect(result.reason).toBe('unsafe');
        });
    });
});
