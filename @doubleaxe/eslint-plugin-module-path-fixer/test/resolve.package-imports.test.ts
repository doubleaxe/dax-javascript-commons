import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { normalizePath } from '../src/normalizer.js';
import { clearAllCaches, createImportResolver } from '../src/resolve.js';
import { useTempFiles } from './util.js';

const {
    fixturesRoot,
    mkTempRoot,
    copyDirectoryRecursive,
    mkTempProjectFromFixture,
    gatLocalProjectFromFixture,
    cleanupTempDirs,
} = useTempFiles('resolve-test-');

afterEach(() => {
    cleanupTempDirs();
    clearAllCaches();
});

describe('resolve.package-imports', () => {
    it('caches nearest config', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');
        const siblingFile = path.join(root, 'src/feature/relative.ts');

        const resolver = createImportResolver();
        const nearestA = resolver.getNearestPackageJson(path.dirname(importer));
        const nearestB = resolver.getNearestPackageJson(path.dirname(siblingFile));

        expect(nearestA).not.toBeNull();
        expect(nearestA).toBe(nearestB);
        expect(nearestA?.path).toBe(normalizePath(path.join(root, 'package.json')));
    });

    it('ignores broken config', () => {
        const root = mkTempProjectFromFixture('package-imports');
        const brokenDir = path.join(root, 'src/broken');
        fs.mkdirSync(brokenDir, { recursive: true });
        fs.writeFileSync(path.join(brokenDir, 'package.json'), '{ invalid json');

        const importer1 = path.join(brokenDir, 'importer.ts');
        const importer2 = path.join(root, 'src/feature/importer.ts');
        const packageJson = normalizePath(path.join(root, 'package.json'));

        const resolver = createImportResolver();
        const nearestA = resolver.getNearestPackageJson(path.dirname(importer1));
        const nearestB = resolver.getNearestPackageJson(path.dirname(importer2));

        expect(nearestA).not.toBeNull();
        expect(nearestB).not.toBeNull();
        expect(nearestA?.path).toBe(packageJson);
        expect(nearestB?.path).toBe(packageJson);
    });

    it('resolves imports without extensions', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        let resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#app/utils/tool',
        });
        let target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/base/value',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        // enhanced resolver prevents it
        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/base/../../utils/tool',
        });
        target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).toBeNull();

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/base/../ext/index',
        });
        target = path.join(root, 'src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolver = createImportResolver({
            extensions: ['.ts', '.js', '.mjs'],
            usePackageJson: ['package-base-values.json'],
        });

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#base-value',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves imports with extensions', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        let resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#app/utils/tool.mjs',
        });
        let target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/base/value.js',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        // enhanced resolver prevents it
        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/base/../../utils/tool.mjs',
        });
        target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).toBeNull();

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/base/../ext/index.ts',
        });
        target = path.join(root, 'src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolver = createImportResolver({
            extensions: ['.ts', '.js', '.mjs'],
            usePackageJson: ['package-base-values.json'],
        });

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#tool',
        });
        target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves *.js imports as js-only targets', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        let resolver = createImportResolver({
            extensions: ['.mjs', '.js'],
            extensionAlias: {},
            usePackageJson: ['package-base-patterns.json'],
        });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#base-any/value',
        });
        let target = path.join(root, 'src/components/base/value.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#base/value.js',
        });
        target = path.join(root, 'src/components/base/value.js');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#base/value.mjs',
        });
        expect(resolved).toBeNull();

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#base/input.ts',
        });
        expect(resolved).toBeNull();

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#base/input.js',
        });
        expect(resolved).toBeNull();

        resolver = createImportResolver({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            usePackageJson: ['package-base-patterns.json'],
        });

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#base/input.js',
        });
        target = path.join(root, 'src/components/base/input.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves imports with extension aliases', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
        });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/base/input.js',
        });
        let target = path.join(root, 'src/components/base/input.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#app/utils/tool.js',
        });
        target = path.join(root, 'src/utils/tool.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves imports for index files', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        let resolver = createImportResolver({
            extensions: ['.ts', '.js', '.mjs'],
            usePackageJson: ['package-base-values.json'],
        });

        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#base',
        });
        let target = path.join(root, 'src/components/base/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/base',
        });
        target = path.join(root, 'src/components/base/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/ext',
        });
        target = path.join(root, 'src/components/ext.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/ext/index',
        });
        target = path.join(root, 'src/components/ext/index.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('respects usePackageJson flag', () => {
        const aliasRoot = gatLocalProjectFromFixture('package-imports');
        const aliasImporter = path.join(aliasRoot, 'src/feature/importer.ts');

        const aliasResolver = createImportResolver({ extensions: ['.ts'], usePackageJson: false });
        const aliasResolved = aliasResolver.resolve({
            importerFile: aliasImporter,
            specifier: '#app/utils/tool',
        });

        expect(aliasResolved).toBeNull();
    });

    it('should not resolve disabled extensions', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({ extensions: ['.mjs'], extensionAlias: { '.mjs': '.mjjss' } });
        let resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#app/utils/tool',
        });
        let target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#app/utils/tool.mjjss',
        });
        target = path.join(root, 'src/utils/tool.mjs');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/base/input',
        });
        expect(resolved).toBeNull();

        resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#components/base/input.ts',
        });
        target = path.join(root, 'src/components/base/input.ts');
        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(normalizePath(target));
    });

    it('resolves package.json through directory symlink', () => {
        const root = mkTempRoot();

        const realDir = path.join(root, 'real');
        copyDirectoryRecursive(path.join(fixturesRoot, 'package-imports'), realDir);

        const linkDir = path.join(root, 'link');
        fs.symlinkSync(realDir, linkDir, 'dir');

        const resolver = createImportResolver({ extensions: ['.ts'] });
        const importer = path.join(linkDir, 'src/feature/importer.ts');
        const nearestA = resolver.getNearestPackageJson(importer);

        const upperOne = path.join(linkDir, 'src/feature.ts');
        const nearestB = resolver.getNearestPackageJson(upperOne);

        expect(nearestA).not.toBeNull();
        expect(nearestA).toBe(nearestB);
        expect(nearestB?.path).toBe(normalizePath(path.join(linkDir, 'package.json')));
    });

    it('resolves imports through directory symlink', () => {
        const root = mkTempRoot();

        const realDir = path.join(root, 'real');
        copyDirectoryRecursive(path.join(fixturesRoot, 'package-imports'), realDir);

        const linkDir = path.join(root, 'link');
        fs.symlinkSync(realDir, linkDir, 'dir');

        const importerLink = path.join(linkDir, 'src/feature/importer.ts');
        const targetLink = path.join(linkDir, 'src/utils/tool.ts');

        const resolver = createImportResolver({ extensions: ['.ts'] });
        const first = resolver.resolve({
            importerFile: importerLink,
            specifier: '#app/utils/tool',
        });

        expect(first).not.toBeNull();
        expect(first?.resolvedFile).toBe(normalizePath(path.normalize(targetLink)));
    });
});
