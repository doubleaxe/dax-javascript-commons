import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { normalizePath } from '../src/normalizer.js';
import { clearAllCaches, createImportResolver } from '../src/resolve.js';
import { useTempFiles } from './util.js';

const { fixturesRoot, mkTempRoot, copyDirectoryRecursive, gatLocalProjectFromFixture, cleanupTempDirs } =
    useTempFiles('resolve-test-');

afterEach(() => {
    cleanupTempDirs();
    clearAllCaches();
});

describe('resolve.relative', () => {
    it('resolves imports without extensions', () => {
        const root = gatLocalProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../utils/tool',
        });
        let target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../components/base/value',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../../../relative/src/components/base/value',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: './relative',
        });
        target = path.join(root, 'src/feature/relative.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves imports with extensions', () => {
        const root = gatLocalProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../utils/tool.mjs',
        });
        let target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../components/base/value.js',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../../../relative/src/components/base/value.js',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: './relative.ts',
        });
        target = path.join(root, 'src/feature/relative.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves imports with extension aliases', () => {
        const root = gatLocalProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({
            extensions: ['.ts', '.js'],
            extensionAlias: { ts: 'js' },
        });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../components/base/input.js',
        });
        let target = path.join(root, 'src/components/base/input.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../utils/tool.js',
        });
        target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves imports for index files', () => {
        const root = gatLocalProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../components/base',
        });
        let target = path.join(root, 'src/components/base/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../components/ext',
        });
        target = path.join(root, 'src/components/ext.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../components/ext/index',
        });
        target = path.join(root, 'src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../components/ext/index.js',
        });
        target = path.join(root, 'src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('should not resolve disabled extensions', () => {
        const root = gatLocalProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({ extensions: ['.mjs'], extensionAlias: { mjs: 'mjjss' } });
        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../utils/tool',
        });
        let target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../utils/tool.mjjss',
        });
        target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../components/base/input',
        });
        expect(resolved).toBeNull();

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../components/base/input.ts',
        });
        target = path.join(root, 'src/components/base/input.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves imports through directory symlink', () => {
        const root = mkTempRoot();

        const realDir = path.join(root, 'real');
        copyDirectoryRecursive(path.join(fixturesRoot, 'relative'), realDir);

        const linkDir = path.join(root, 'link');
        fs.symlinkSync(realDir, linkDir, 'dir');

        const importerReal = path.join(realDir, 'src/feature/importer.ts');
        const targetReal = path.join(realDir, 'src/utils/tool.ts');
        const importerLink = path.join(linkDir, 'src/feature/importer.ts');
        const targetLink = path.join(linkDir, 'src/utils/tool.ts');

        // from link to link
        const resolver = createImportResolver({ extensions: ['.ts'] });
        const first = resolver.resolve({
            importerFile: importerLink,
            specifier: '../utils/tool',
        });

        expect(first).not.toBeNull();
        expect(first?.resolvedFile).toBe(normalizePath(targetLink));

        // from real to link
        const second = resolver.resolve({
            importerFile: importerReal,
            specifier: '../../../link/src/utils/tool',
        });
        expect(second).not.toBeNull();
        expect(second?.resolvedFile).toBe(normalizePath(targetLink));

        // from link to real
        const third = resolver.resolve({
            importerFile: importerLink,
            specifier: '../../../real/src/utils/tool',
        });
        expect(third).not.toBeNull();
        expect(third?.resolvedFile).toBe(normalizePath(targetReal));
    });
});
