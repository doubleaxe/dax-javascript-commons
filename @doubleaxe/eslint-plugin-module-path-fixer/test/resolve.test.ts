import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { clearAllCaches, createImportResolver } from '../src/resolve.js';

const tempRoots: string[] = [];
const fixturesRoot = path.resolve(process.cwd(), 'test-assets');

function mkTempRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-test-'));
    tempRoots.push(root);
    return root;
}

function copyDirectoryRecursive(sourceDir: string, targetDir: string): void {
    fs.mkdirSync(targetDir, { recursive: true });

    const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            copyDirectoryRecursive(sourcePath, targetPath);
            continue;
        }

        if (entry.isFile()) {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

function mkTempProjectFromFixture(fixtureName: string): string {
    const root = mkTempRoot();
    const fixturePath = path.join(fixturesRoot, fixtureName);
    copyDirectoryRecursive(fixturePath, root);
    return root;
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

describe('ImportResolver', () => {
    describe('tsconfig', () => {
        it('caches nearest config', () => {
            const root = mkTempProjectFromFixture('tsconfig');
            const importer = path.join(root, 'src/feature/importer.ts');
            const siblingFile = path.join(root, 'src/feature/relative.ts');

            const resolver = createImportResolver();
            const nearestA = resolver.getNearestTsJsConfig(path.dirname(importer));
            const nearestB = resolver.getNearestTsJsConfig(path.dirname(siblingFile));

            expect(nearestA).not.toBeNull();
            expect(nearestA).toBe(nearestB);
        });

        it('ignores broken config', () => {
            const root = mkTempProjectFromFixture('tsconfig');
            const importer1 = path.join(root, 'src/broken/importer.ts');
            const importer2 = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ useTsConfig: 'tsconfig.txt' });
            const nearestA = resolver.getNearestTsJsConfig(path.dirname(importer1));
            const nearestB = resolver.getNearestTsJsConfig(path.dirname(importer2));
            const tsconfig = path.join(root, 'tsconfig.txt');

            expect(nearestA).not.toBeNull();
            expect(nearestB).not.toBeNull();
            expect(nearestA?.path).toBe(tsconfig);
            expect(nearestB?.path).toBe(tsconfig);
        });

        it('can use extended tsconfig', () => {
            const root = mkTempProjectFromFixture('tsconfig');
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
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@base/value',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            const nearestA = resolver.getNearestTsJsConfig(path.dirname(importer));
            const tsconfig = path.join(root, 'tsconfig-extends.json');
            expect(nearestA).not.toBeNull();
            expect(nearestA?.path).toBe(tsconfig);
            expect(nearestA?.alias.some(({ name }) => name === '@app/*')).toBeTruthy();
        });

        it('resolves aliases via nearest tsconfig paths without extensions', () => {
            const root = mkTempProjectFromFixture('tsconfig');
            const importer = path.join(root, 'src/feature/importer.ts');

            let resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@app/utils/tool',
            });
            let target = path.join(root, 'src/utils/tool.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@base/value',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'], useTsConfig: 'tsconfig-files.json' });

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: 'base-value',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves aliases via nearest tsconfig paths with extensions', () => {
            const root = mkTempProjectFromFixture('alias');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/utils/tool.ts');

            const resolver = createImportResolver({ extensions: ['.ts'] });
            const resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@app/utils/tool.js',
            });

            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves aliases via nearest tsconfig paths with extension aliases', () => {
            const root = mkTempProjectFromFixture('alias');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/utils/tool.ts');

            const resolver = createImportResolver({ extensions: ['.ts'] });
            const resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@app/utils/tool.js',
            });

            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves aliases via nearest tsconfig paths for index files', () => {
            const root = mkTempProjectFromFixture('tsconfig');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@app/utils/tool',
            });
            let target = path.join(root, 'src/utils/tool.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@app/components/tool',
            });
            target = path.join(root, 'src/utils/tool.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves manual tsconfig aliases from resolver options', () => {
            const root = mkTempProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/utils/helper.ts');

            const resolver = createImportResolver({
                extensions: ['.ts'],
                manualTsConfigs: [{ baseUrl: root, paths: { '@manual/*': ['src/*'] } }],
            });

            const resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@manual/utils/helper',
            });

            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves using matching entry from multiple manualTsConfigs', () => {
            const root = mkTempProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/utils/helper.ts');

            const resolver = createImportResolver({
                extensions: ['.ts'],
                manualTsConfigs: [
                    { baseUrl: root, paths: { '@other/*': ['src/other/*'] } },
                    { baseUrl: root, paths: { '@manual/*': ['src/*'] } },
                ],
            });

            const resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@manual/utils/helper',
            });

            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves manual tsconfig aliases even when useTsConfig is disabled', () => {
            const root = mkTempProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/utils/helper.ts');

            const resolver = createImportResolver({
                extensions: ['.ts'],
                useTsConfig: false,
                manualTsConfigs: [{ baseUrl: root, paths: { '@manual/*': ['src/*'] } }],
            });

            const resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@manual/utils/helper',
            });

            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('respects useTsConfig flag', () => {
            const aliasRoot = mkTempProjectFromFixture('alias');
            const aliasImporter = path.join(aliasRoot, 'src/feature/importer.ts');

            const aliasResolver = createImportResolver({ extensions: ['.ts'], useTsConfig: false });
            const aliasResolved = aliasResolver.resolve({
                importerFile: aliasImporter,
                specifier: '@app/utils/tool',
            });

            expect(aliasResolved).toBeNull();
        });

        it('should not resolve foreign extensions', () => {
            const root = mkTempProjectFromFixture('imports');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/core/core.mjs');

            const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mts', '.mjs'] });
            const resolved1 = resolver.resolve({
                importerFile: importer,
                specifier: '#core/core.ts',
            });

            expect(resolved1).toBeNull();

            const resolved2 = resolver.resolve({
                importerFile: importer,
                specifier: '#core/core.mts',
            });

            expect(resolved2).not.toBeNull();
            expect(resolved2?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves tsconfig through directory symlink', () => {
            const root = mkTempRoot();

            const realDir = path.join(root, 'real');
            copyDirectoryRecursive(path.join(fixturesRoot, 'alias'), realDir);

            const linkDir = path.join(root, 'link');
            fs.symlinkSync(realDir, linkDir, 'dir');

            const resolver = createImportResolver({ extensions: ['.ts'] });
            const importer = path.join(linkDir, 'src/feature/importer.ts');
            const nearestA = resolver.getNearestPackageJson(importer);

            const upperOne = path.join(linkDir, 'src/feature.ts');
            const nearestB = resolver.getNearestPackageJson(upperOne);

            expect(nearestA).not.toBeNull();
            expect(nearestA).toBe(nearestB);
            expect(nearestB?.path).toBe(path.join(linkDir, 'package.json'));
        });
    });

    describe('package.json', () => {
        it('resolves #imports via nearest package.json imports and caches package location', () => {
            const root = mkTempProjectFromFixture('imports');
            const importer = path.join(root, 'src/feature/importer.ts');
            const siblingFile = path.join(root, 'src/feature/another.ts');
            const target = path.join(root, 'src/core/core.mjs');

            const resolver = createImportResolver({ extensions: ['.ts'] });
            const resolved1 = resolver.resolve({
                importerFile: importer,
                specifier: '#core/core.mjs',
            });

            expect(resolved1).not.toBeNull();
            expect(resolved1?.resolvedFile).toBe(path.normalize(target));

            const resolved2 = resolver.resolve({
                importerFile: importer,
                specifier: '#core-mjs',
            });
            expect(resolved2).not.toBeNull();
            expect(resolved2?.resolvedFile).toBe(path.normalize(target));

            const nearestA = resolver.getNearestPackageJson(importer);
            const nearestB = resolver.getNearestPackageJson(siblingFile);

            expect(nearestA).not.toBeNull();
            expect(nearestA).toBe(nearestB);
        });

        it('resolves explicit js specifiers through package imports to ts sources', () => {
            const root = mkTempProjectFromFixture('imports');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/core/index.ts');

            const resolver = createImportResolver({ extensions: ['.ts'] });
            const resolved1 = resolver.resolve({
                importerFile: importer,
                specifier: '#core/index.js',
            });

            expect(resolved1).not.toBeNull();
            expect(resolved1?.resolvedFile).toBe(path.normalize(target));
        });

        it('should not resolve foreign extensions', () => {
            const root = mkTempProjectFromFixture('imports');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/core/core.mjs');

            const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mts', '.mjs'] });
            const resolved1 = resolver.resolve({
                importerFile: importer,
                specifier: '#core/core.ts',
            });

            expect(resolved1).toBeNull();

            const resolved2 = resolver.resolve({
                importerFile: importer,
                specifier: '#core/core.mts',
            });

            expect(resolved2).not.toBeNull();
            expect(resolved2?.resolvedFile).toBe(path.normalize(target));
        });

        it('respects usePackageJson flag', () => {
            const importsRoot = mkTempProjectFromFixture('imports');
            const importsImporter = path.join(importsRoot, 'src/feature/importer.ts');

            const importsResolver = createImportResolver({ extensions: ['.ts'], usePackageJson: false });
            const importsResolved = importsResolver.resolve({
                importerFile: importsImporter,
                specifier: '#core/core.mjs',
            });

            expect(importsResolved).toBeNull();
        });
    });

    describe('relative', () => {
        it('resolves relative imports', () => {
            const root = mkTempProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/utils/helper.ts');

            const resolver = createImportResolver({ extensions: ['.ts'] });
            const resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../utils/helper',
            });

            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves explicit js specifiers to ts sources with the default extension aliases', () => {
            const root = mkTempProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/core/value.ts');

            fs.rmSync(path.join(root, 'src/core/value.js'));

            const resolver = createImportResolver({ extensions: ['.ts'] });
            const resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../core/value.js',
            });

            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('uses custom extension aliases when resolving explicit specifiers', () => {
            const root = mkTempProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');
            const target = path.join(root, 'src/core/custom.ts');

            fs.writeFileSync(target, 'export const custom = true;\n');

            const resolver = createImportResolver({
                extensions: ['.ts'],
                extensionAlias: { ts: 'jsx' },
            });
            const resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../core/custom.jsx',
            });

            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('caches resolved import result and recomputes after clearCaches', () => {
            const root = mkTempProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');
            const tsTarget = path.join(root, 'src/core/value.ts');
            const jsTarget = path.join(root, 'src/core/value.js');

            const resolver = createImportResolver({ extensions: ['.ts', '.js'] });

            const first = resolver.resolve({
                importerFile: importer,
                specifier: '../core/value',
            });

            expect(first).not.toBeNull();
            expect(first?.resolvedFile).toBe(path.normalize(tsTarget));

            fs.rmSync(tsTarget);

            const second = resolver.resolve({
                importerFile: importer,
                specifier: '../core/value',
            });

            expect(second).toBe(first);
            expect(second?.resolvedFile).toBe(path.normalize(tsTarget));

            clearAllCaches();

            const third = resolver.resolve({
                importerFile: importer,
                specifier: '../core/value',
            });

            expect(third).not.toBeNull();
            expect(third?.resolvedFile).toBe(path.normalize(jsTarget));
        });

        it('resolves imports through directory symlink', () => {
            const root = mkTempRoot();

            const realDir = path.join(root, 'real');
            copyDirectoryRecursive(path.join(fixturesRoot, 'relative'), realDir);

            const linkDir = path.join(root, 'link');
            fs.symlinkSync(realDir, linkDir, 'dir');

            const importerReal = path.join(realDir, 'src/feature/importer.ts');
            const targetReal = path.join(realDir, 'src/utils/helper.ts');
            const importerLink = path.join(linkDir, 'src/feature/importer.ts');
            const targetLink = path.join(linkDir, 'src/utils/helper.ts');

            // from link to link
            const resolver = createImportResolver({ extensions: ['.ts'] });
            const first = resolver.resolve({
                importerFile: importerLink,
                specifier: '../utils/helper',
            });

            expect(first).not.toBeNull();
            expect(first?.resolvedFile).toBe(path.normalize(targetLink));

            // from real to link
            const second = resolver.resolve({
                importerFile: importerReal,
                specifier: '../../../link/src/utils/helper',
            });
            expect(second).not.toBeNull();
            expect(second?.resolvedFile).toBe(path.normalize(targetLink));

            // from link to real
            const third = resolver.resolve({
                importerFile: importerLink,
                specifier: '../../../real/src/utils/helper',
            });
            expect(third).not.toBeNull();
            expect(third?.resolvedFile).toBe(path.normalize(targetReal));
        });
    });
});
