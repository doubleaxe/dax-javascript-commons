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

describe('resolve.tsconfig', () => {
    it('caches nearest config', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');
        const siblingFile = path.join(root, 'src/feature/relative.ts');

        const resolver = createImportResolver();
        const nearestA = resolver.getNearestTsJsConfig(path.dirname(importer));
        const nearestB = resolver.getNearestTsJsConfig(path.dirname(siblingFile));

        expect(nearestA).not.toBeNull();
        expect(nearestA).toBe(nearestB);
    });

    it('ignores broken config', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer1 = path.join(root, 'src/broken/importer.ts');
        const importer2 = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({ useTsConfig: 'tsconfig.txt' });
        const nearestA = resolver.getNearestTsJsConfig(path.dirname(importer1));
        const nearestB = resolver.getNearestTsJsConfig(path.dirname(importer2));
        const tsconfig = normalizePath(path.join(root, 'tsconfig.txt'));

        expect(nearestA).not.toBeNull();
        expect(nearestB).not.toBeNull();
        expect(nearestA?.path).toBe(tsconfig);
        expect(nearestB?.path).toBe(tsconfig);
    });

    it('can use absolute tsconfig', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');
        const tsconfig1 = path.join(root, 'src/broken/tsconfig.txt');
        const tsconfig2 = path.join(root, 'tsconfig.txt');

        const resolver = createImportResolver({
            useTsConfig: [tsconfig1, tsconfig2],
        });

        const nearestA = resolver.getNearestTsJsConfig(path.dirname(importer));

        expect(nearestA).not.toBeNull();
        expect(nearestA?.path).toBe(normalizePath(tsconfig2));
    });

    it('can use extended tsconfig', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({
            extensions: ['.ts', '.js', '.mjs'],
            useTsConfig: 'tsconfig-extends.json',
        });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@app/utils/tool',
        });
        let target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@base/value',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        const nearestA = resolver.getNearestTsJsConfig(path.dirname(importer));
        const tsconfig = path.join(root, 'tsconfig-extends.json');
        expect(nearestA).not.toBeNull();
        expect(nearestA?.path).toBe(normalizePath(tsconfig));
        expect(nearestA?.alias.some(({ name }) => name === '@app/*')).toBeTruthy();
    });

    it('resolves aliases without extensions', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        let resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@app/utils/tool',
        });
        let target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@base/value',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@components/base/../../utils/tool',
        });
        target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@components/base/../ext/index',
        });
        target = path.join(root, 'src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'], useTsConfig: 'tsconfig-files.json' });

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '$base-value',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves aliases with extensions', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        let resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@app/utils/tool.mjs',
        });
        let target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@base/value.js',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@components/base/../../utils/tool.mjs',
        });
        target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@components/base/../ext/index.ts',
        });
        target = path.join(root, 'src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolver = createImportResolver({
            extensions: ['.ts', '.js', '.mjs'],
            useTsConfig: 'tsconfig-files-ext.json',
        });

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '$tool',
        });
        target = path.join(root, 'src/utils/tool.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves aliases with extension aliases', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({
            extensions: ['.ts', '.js'],
            extensionAlias: { ts: 'js' },
        });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@base/input.js',
        });
        let target = path.join(root, 'src/components/base/input.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        // alias has priority
        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@app/utils/tool.js',
        });
        target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves aliases for index files', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@components/base',
        });
        let target = path.join(root, 'src/components/base/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@components/ext',
        });
        target = path.join(root, 'src/components/ext.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@components/ext/index',
        });
        target = path.join(root, 'src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@components/ext/index.js',
        });
        target = path.join(root, 'src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves fallback paths', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({
            extensions: ['.ts', '.js'],
            useTsConfig: 'tsconfig-fallback.json',
        });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@app/utils/tool',
        });
        let target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '$base-value',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '$base',
        });
        target = path.join(root, 'src/components/base/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves manual aliases from resolver options', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({
            useTsConfig: false,
            extensions: ['.ts', '.js'],
            manualTsConfigs: [
                {
                    baseUrl: root,
                    paths: { '@manual/*': ['src/*'], '$base': ['./no-src/base', './src/components/base'] },
                },
                { baseUrl: path.join(root, 'src'), paths: { '@manual-comp/*': ['./components/*'] } },
            ],
        });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@manual/utils/tool',
        });

        let target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '$base',
        });
        target = path.join(root, 'src/components/base/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@manual-comp/ext.js',
        });
        target = path.join(root, 'src/components/ext.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('respects useTsConfig flag', () => {
        const aliasRoot = gatLocalProjectFromFixture('tsconfig');
        const aliasImporter = path.join(aliasRoot, 'src/feature/importer.ts');

        const aliasResolver = createImportResolver({ extensions: ['.ts'], useTsConfig: false });
        const aliasResolved = aliasResolver.resolve({
            importerFile: aliasImporter,
            specifier: '@app/utils/tool',
        });

        expect(aliasResolved).toBeNull();
    });

    it('should not resolve disabled extensions', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({ extensions: ['.mjs'], extensionAlias: { mjs: 'mjjss' } });
        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@app/utils/tool',
        });
        let target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@app/utils/tool.mjjss',
        });
        target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@components/base/input',
        });
        expect(resolved).toBeNull();

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@components/base/input.ts',
        });
        target = path.join(root, 'src/components/base/input.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves tsconfig through directory symlink', () => {
        const root = mkTempRoot();

        const realDir = path.join(root, 'real');
        copyDirectoryRecursive(path.join(fixturesRoot, 'tsconfig'), realDir);

        const linkDir = path.join(root, 'link');
        fs.symlinkSync(realDir, linkDir, 'dir');

        const resolver = createImportResolver({ extensions: ['.ts'] });
        const importer = path.join(linkDir, 'src/feature/importer.ts');
        const nearestA = resolver.getNearestTsJsConfig(importer);

        const upperOne = path.join(linkDir, 'src/feature.ts');
        const nearestB = resolver.getNearestTsJsConfig(upperOne);

        expect(nearestA).not.toBeNull();
        expect(nearestA).toBe(nearestB);
        expect(nearestB?.path).toBe(normalizePath(path.join(linkDir, 'tsconfig.json')));
    });

    it('resolves imports through directory symlink', () => {
        const root = mkTempRoot();

        const realDir = path.join(root, 'real');
        copyDirectoryRecursive(path.join(fixturesRoot, 'tsconfig'), realDir);

        const linkDir = path.join(root, 'link');
        fs.symlinkSync(realDir, linkDir, 'dir');

        const importerLink = path.join(linkDir, 'src/feature/importer.ts');
        const targetLink = path.join(linkDir, 'src/utils/tool.ts');

        const resolver = createImportResolver({ extensions: ['.ts'] });
        const first = resolver.resolve({
            importerFile: importerLink,
            specifier: '@app/utils/tool',
        });

        expect(first).not.toBeNull();
        expect(first?.resolvedFile).toBe(normalizePath(targetLink));
    });
});
