import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { clearAllCaches, createImportResolver } from '../src/resolve.js';
import { useTempFiles } from './util.js';

const { gatLocalProjectFromFixture, cleanupTempDirs } = useTempFiles('resolve-test-');

afterEach(() => {
    cleanupTempDirs();
    clearAllCaches();
});

describe('resolve.absolute', () => {
    it('resolves imports without extensions', () => {
        const root = gatLocalProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');
        const absolute = (relativePath: string) => path.join(root, relativePath);

        const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/utils/tool'),
        });
        let target = absolute('src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/components/../../src/components/base/value'),
        });
        target = absolute('src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('resolves imports with extensions', () => {
        const root = gatLocalProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');
        const absolute = (relativePath: string) => path.join(root, relativePath);

        const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/utils/tool.mjs'),
        });
        let target = absolute('src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/components/../../src/components/base/value.js'),
        });
        target = absolute('src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('resolves imports with extension aliases', () => {
        const root = gatLocalProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');
        const absolute = (relativePath: string) => path.join(root, relativePath);

        const resolver = createImportResolver({
            extensions: ['.ts', '.js'],
            extensionAlias: { ts: 'js' },
        });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/components/base/input.js'),
        });
        let target = absolute('src/components/base/input.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/utils/tool.js'),
        });
        target = absolute('src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('resolves imports for index files', () => {
        const root = gatLocalProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');
        const absolute = (relativePath: string) => path.join(root, relativePath);

        const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/components/base'),
        });
        let target = absolute('src/components/base/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/components/ext'),
        });
        target = absolute('src/components/ext.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/components/ext/index'),
        });
        target = absolute('src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/components/ext/index.js'),
        });
        target = absolute('src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('should not resolve disabled extensions', () => {
        const root = gatLocalProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');
        const absolute = (relativePath: string) => path.join(root, relativePath);

        const resolver = createImportResolver({ extensions: ['.mjs'], extensionAlias: { mjs: 'mjjss' } });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/utils/tool'),
        });
        let target = absolute('src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/utils/tool.mjjss'),
        });
        target = absolute('src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/components/base/input'),
        });
        expect(resolved).toBeNull();

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: absolute('src/components/base/input.ts'),
        });
        target = absolute('src/components/base/input.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });
});
