import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { clearAllCaches } from '../src/resolve.js';
import { createExtensionsCore } from '../src/rules/extensions/index.js';
import { useTempFiles } from './util.js';

const { gatLocalProjectFromFixture, cleanupTempDirs } = useTempFiles('extensions-core-test-');

afterEach(() => {
    cleanupTempDirs();
    clearAllCaches();
});

describe('extensions-core.tsconfig', () => {
    it('extension mode is always', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        let core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
        });

        let result = core.evaluate({
            importerFile: importer,
            specifier: '@base/value',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@base/value.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@app/feature/relative.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative.ts',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@app/feature/relative.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative.js',
        });
        expect(result.reason).toBe('unchanged');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative.mjs',
        });
        expect(result.reason).toBe('unresolved');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/utils/../utils/tool',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@app/utils/../utils/tool.js');

        core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: false,
            extensions: ['.ts'],
            extensionAlias: {},
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@app/feature/relative.ts');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@base/value',
        });
        expect(result.reason).toBe('unresolved');

        core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            useTsConfig: 'tsconfig-files.json',
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '$base-value',
        });
        expect(result.reason).toBe('unsafe');

        core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            useTsConfig: 'tsconfig-files-ext.json',
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '$tool',
        });
        expect(result.reason).toBe('unsafe');
    });

    it('extension mode is never', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        let core = createExtensionsCore({
            preferExtension: false,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
        });

        let result = core.evaluate({
            importerFile: importer,
            specifier: '@base/value.js',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@base/value');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative.js',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@app/feature/relative');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative.ts',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@app/feature/relative');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative',
        });
        expect(result.reason).toBe('unchanged');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative.mjs',
        });
        expect(result.reason).toBe('unresolved');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/utils/../utils/tool.js',
        });
        expect(result.reason).toBe('changed');
        expect(result?.nextSpecifier).toBe('@app/utils/../utils/tool');

        core = createExtensionsCore({
            preferExtension: false,
            preferDirectoryIndex: false,
            extensions: ['.ts'],
            extensionAlias: {},
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative.ts',
        });
        expect(result.reason).toBe('changed');
        expect(result?.nextSpecifier).toBe('@app/feature/relative');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@base/value.js',
        });
        expect(result.reason).toBe('unsafe');

        core = createExtensionsCore({
            preferExtension: false,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            useTsConfig: 'tsconfig-files.json',
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '$base-value',
        });
        expect(result.reason).toBe('unchanged');

        core = createExtensionsCore({
            preferExtension: false,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            useTsConfig: 'tsconfig-files-ext.json',
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '$tool',
        });
        expect(result.reason).toBe('unchanged');
    });

    it('index mode is always', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        let core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: true,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
        });

        let result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base/index.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base/index.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base/index.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components\\base\\',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components\\base\\index.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.ts',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base/index.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.js',
        });
        expect(result.reason).toBe('unchanged');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.mjs',
        });
        expect(result.reason).toBe('unresolved');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/utils',
        });
        expect(result.reason).toBe('unresolved');

        core = createExtensionsCore({
            preferExtension: false,
            preferDirectoryIndex: true,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base/index');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index',
        });
        expect(result.reason).toBe('unchanged');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.ts',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base/index');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.js',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base/index');

        core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: true,
            extensions: ['.ts'],
            extensionAlias: {},
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base/index.ts');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base/index.ts');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.ts',
        });
        expect(result.reason).toBe('unchanged');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.js',
        });
        expect(result.reason).toBe('unresolved');

        core = createExtensionsCore({
            preferExtension: false,
            preferDirectoryIndex: true,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            useTsConfig: 'tsconfig-files.json',
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '$base',
        });
        expect(result.reason).toBe('unsafe');

        core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: true,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            useTsConfig: 'tsconfig-files.json',
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '$base',
        });
        expect(result.reason).toBe('unsafe');
    });

    it('index mode is never', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        let core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
        });

        let result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base',
        });
        expect(result.reason).toBe('unchanged');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components\\base\\',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components\\base');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.ts',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.js',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.mjs',
        });
        expect(result.reason).toBe('unresolved');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/utils',
        });
        expect(result.reason).toBe('unresolved');

        core = createExtensionsCore({
            preferExtension: false,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base',
        });
        expect(result.reason).toBe('unchanged');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.ts',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.js',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base');

        core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: false,
            extensions: ['.ts'],
            extensionAlias: {},
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.ts',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/base');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/index.js',
        });
        expect(result.reason).toBe('unresolved');

        core = createExtensionsCore({
            preferExtension: false,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            useTsConfig: 'tsconfig-files.json',
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '$base',
        });
        expect(result.reason).toBe('unchanged');
    });

    it('skips ambigous index files', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        let core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: true,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
        });

        let result = core.evaluate({
            importerFile: importer,
            specifier: '@components/ext',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/ext.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/ext/',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/ext/index.js');

        core = createExtensionsCore({
            preferExtension: false,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/ext',
        });
        expect(result.reason).toBe('unchanged');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/ext/',
        });
        expect(result.reason).toBe('unsafe');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/ext/index',
        });
        expect(result.reason).toBe('unsafe');

        core = createExtensionsCore({
            preferExtension: true,
            preferDirectoryIndex: false,
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/ext',
        });
        expect(result.reason).toBe('changed');
        expect(result.nextSpecifier).toBe('@components/ext.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/ext/',
        });
        expect(result.reason).toBe('unsafe');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/ext/index.js',
        });
        expect(result.reason).toBe('unsafe');
    });
});
