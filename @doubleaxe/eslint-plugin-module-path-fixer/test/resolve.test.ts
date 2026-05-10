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

describe('ImportResolver', () => {
    describe('tsconfig', () => {
        it('caches nearest config', () => {
            const root = useLocalProjectFromFixture('tsconfig');
            const importer = path.join(root, 'src/feature/importer.ts');
            const siblingFile = path.join(root, 'src/feature/relative.ts');

            const resolver = createImportResolver();
            const nearestA = resolver.getNearestTsJsConfig(path.dirname(importer));
            const nearestB = resolver.getNearestTsJsConfig(path.dirname(siblingFile));

            expect(nearestA).not.toBeNull();
            expect(nearestA).toBe(nearestB);
        });

        it('ignores broken config', () => {
            const root = useLocalProjectFromFixture('tsconfig');
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

        it('can use absolute tsconfig', () => {
            const root = useLocalProjectFromFixture('tsconfig');
            const importer = path.join(root, 'src/feature/importer.ts');
            const tsconfig1 = path.join(root, 'src/broken/tsconfig.txt');
            const tsconfig2 = path.join(root, 'tsconfig.txt');

            const resolver = createImportResolver({
                useTsConfig: [tsconfig1, tsconfig2],
            });

            const nearestA = resolver.getNearestTsJsConfig(path.dirname(importer));

            expect(nearestA).not.toBeNull();
            expect(nearestA?.path).toBe(tsconfig2);
        });

        it('can use extended tsconfig', () => {
            const root = useLocalProjectFromFixture('tsconfig');
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

        it('resolves aliases without extensions', () => {
            const root = useLocalProjectFromFixture('tsconfig');
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
                specifier: '$base-value',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves aliases with extensions', () => {
            const root = useLocalProjectFromFixture('tsconfig');
            const importer = path.join(root, 'src/feature/importer.ts');

            let resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@app/utils/tool.mjs',
            });
            let target = path.join(root, 'src/utils/tool.mjs');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@base/value.js',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

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
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves aliases with extension aliases', () => {
            const root = useLocalProjectFromFixture('tsconfig');
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
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            // alias has priority
            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@app/utils/tool.js',
            });
            target = path.join(root, 'src/utils/tool.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves aliases for index files', () => {
            const root = useLocalProjectFromFixture('tsconfig');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@components/base',
            });
            let target = path.join(root, 'src/components/base/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@components/ext',
            });
            target = path.join(root, 'src/components/ext.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@components/ext/index',
            });
            target = path.join(root, 'src/components/ext/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@components/ext/index.js',
            });
            target = path.join(root, 'src/components/ext/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves fallback paths', () => {
            const root = useLocalProjectFromFixture('tsconfig');
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
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '$base-value',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '$base',
            });
            target = path.join(root, 'src/components/base/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves manual aliases from resolver options', () => {
            const root = useLocalProjectFromFixture('tsconfig');
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
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '$base',
            });
            target = path.join(root, 'src/components/base/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@manual-comp/ext.js',
            });
            target = path.join(root, 'src/components/ext.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('respects useTsConfig flag', () => {
            const aliasRoot = useLocalProjectFromFixture('tsconfig');
            const aliasImporter = path.join(aliasRoot, 'src/feature/importer.ts');

            const aliasResolver = createImportResolver({ extensions: ['.ts'], useTsConfig: false });
            const aliasResolved = aliasResolver.resolve({
                importerFile: aliasImporter,
                specifier: '@app/utils/tool',
            });

            expect(aliasResolved).toBeNull();
        });

        it('should not resolve disabled extensions', () => {
            const root = useLocalProjectFromFixture('tsconfig');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.mjs'], extensionAlias: { mjs: 'mjjss' } });
            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@app/utils/tool',
            });
            let target = path.join(root, 'src/utils/tool.mjs');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '@app/utils/tool.mjjss',
            });
            target = path.join(root, 'src/utils/tool.mjs');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

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
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
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
            expect(nearestB?.path).toBe(path.join(linkDir, 'tsconfig.json'));
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
            expect(first?.resolvedFile).toBe(path.normalize(targetLink));
        });
    });

    describe('package.json', () => {
        it('caches nearest config', () => {
            const root = useLocalProjectFromFixture('package-imports');
            const importer = path.join(root, 'src/feature/importer.ts');
            const siblingFile = path.join(root, 'src/feature/relative.ts');

            const resolver = createImportResolver();
            const nearestA = resolver.getNearestPackageJson(path.dirname(importer));
            const nearestB = resolver.getNearestPackageJson(path.dirname(siblingFile));

            expect(nearestA).not.toBeNull();
            expect(nearestA).toBe(nearestB);
            expect(nearestA?.path).toBe(path.join(root, 'package.json'));
        });

        it('ignores broken config', () => {
            const root = mkTempProjectFromFixture('package-imports');
            const brokenDir = path.join(root, 'src/broken');
            fs.mkdirSync(brokenDir, { recursive: true });
            fs.writeFileSync(path.join(brokenDir, 'package.json'), '{ invalid json');

            const importer1 = path.join(brokenDir, 'importer.ts');
            const importer2 = path.join(root, 'src/feature/importer.ts');
            const packageJson = path.join(root, 'package.json');

            const resolver = createImportResolver();
            const nearestA = resolver.getNearestPackageJson(path.dirname(importer1));
            const nearestB = resolver.getNearestPackageJson(path.dirname(importer2));

            expect(nearestA).not.toBeNull();
            expect(nearestB).not.toBeNull();
            expect(nearestA?.path).toBe(packageJson);
            expect(nearestB?.path).toBe(packageJson);
        });

        it('resolves imports without extensions', () => {
            const root = useLocalProjectFromFixture('package-imports');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#app/utils/tool',
            });
            let target = path.join(root, 'src/utils/tool.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#components/base/value',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#base-value',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves imports with extensions', () => {
            const root = useLocalProjectFromFixture('package-imports');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#app/utils/tool.mjs',
            });
            let target = path.join(root, 'src/utils/tool.mjs');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#components/base/value.js',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#tool',
            });
            target = path.join(root, 'src/utils/tool.mjs');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves *.js imports as js-only targets', () => {
            const root = useLocalProjectFromFixture('package-imports');
            const importer = path.join(root, 'src/feature/importer.ts');

            let resolver = createImportResolver({ extensions: ['.mjs', '.js'], extensionAlias: {} });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#base-any/value',
            });
            let target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#base/value.js',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

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
                extensionAlias: { ts: 'js' },
            });
            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#base/input.js',
            });
            target = path.join(root, 'src/components/base/input.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves imports with extension aliases', () => {
            const root = useLocalProjectFromFixture('package-imports');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({
                extensions: ['.ts', '.js'],
                extensionAlias: { ts: 'js' },
            });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#components/base/input.js',
            });
            let target = path.join(root, 'src/components/base/input.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#app/utils/tool.js',
            });
            target = path.join(root, 'src/utils/tool.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves imports for index files', () => {
            const root = useLocalProjectFromFixture('package-imports');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#base',
            });
            let target = path.join(root, 'src/components/base/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#components/base',
            });
            target = path.join(root, 'src/components/base/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#components/ext',
            });
            target = path.join(root, 'src/components/ext.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#components/ext/index',
            });
            target = path.join(root, 'src/components/ext/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('respects usePackageJson flag', () => {
            const aliasRoot = useLocalProjectFromFixture('package-imports');
            const aliasImporter = path.join(aliasRoot, 'src/feature/importer.ts');

            const aliasResolver = createImportResolver({ extensions: ['.ts'], usePackageJson: false });
            const aliasResolved = aliasResolver.resolve({
                importerFile: aliasImporter,
                specifier: '#app/utils/tool',
            });

            expect(aliasResolved).toBeNull();
        });

        it('should not resolve disabled extensions', () => {
            const root = useLocalProjectFromFixture('package-imports');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.mjs'], extensionAlias: { mjs: 'mjjss' } });
            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#app/utils/tool',
            });
            let target = path.join(root, 'src/utils/tool.mjs');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '#app/utils/tool.mjjss',
            });
            target = path.join(root, 'src/utils/tool.mjs');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

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
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
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
            expect(nearestB?.path).toBe(path.join(linkDir, 'package.json'));
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
            expect(first?.resolvedFile).toBe(path.normalize(targetLink));
        });
    });

    describe('relative', () => {
        it('resolves imports without extensions', () => {
            const root = useLocalProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../utils/tool',
            });
            let target = path.join(root, 'src/utils/tool.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../components/base/value',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: './relative',
            });
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves imports with extensions', () => {
            const root = useLocalProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../utils/tool.mjs',
            });
            let target = path.join(root, 'src/utils/tool.mjs');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../components/base/value.js',
            });
            target = path.join(root, 'src/components/base/value.js');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: './relative.ts',
            });
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves imports with extension aliases', () => {
            const root = useLocalProjectFromFixture('relative');
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
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../utils/tool.js',
            });
            target = path.join(root, 'src/utils/tool.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('resolves imports for index files', () => {
            const root = useLocalProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.ts', '.js', '.mjs'] });

            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../components/base',
            });
            let target = path.join(root, 'src/components/base/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../components/ext',
            });
            target = path.join(root, 'src/components/ext.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../components/ext/index',
            });
            target = path.join(root, 'src/components/ext/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../components/ext/index.js',
            });
            target = path.join(root, 'src/components/ext/index.ts');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
        });

        it('should not resolve disabled extensions', () => {
            const root = useLocalProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');

            const resolver = createImportResolver({ extensions: ['.mjs'], extensionAlias: { mjs: 'mjjss' } });
            let resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../utils/tool',
            });
            let target = path.join(root, 'src/utils/tool.mjs');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

            resolved = resolver.resolve({
                importerFile: importer,
                specifier: '../utils/tool.mjjss',
            });
            target = path.join(root, 'src/utils/tool.mjs');
            expect(resolved).not.toBeNull();
            expect(resolved?.resolvedFile).toBe(path.normalize(target));

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
            expect(resolved?.resolvedFile).toBe(path.normalize(target));
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
            expect(first?.resolvedFile).toBe(path.normalize(targetLink));

            // from real to link
            const second = resolver.resolve({
                importerFile: importerReal,
                specifier: '../../../link/src/utils/tool',
            });
            expect(second).not.toBeNull();
            expect(second?.resolvedFile).toBe(path.normalize(targetLink));

            // from link to real
            const third = resolver.resolve({
                importerFile: importerLink,
                specifier: '../../../real/src/utils/tool',
            });
            expect(third).not.toBeNull();
            expect(third?.resolvedFile).toBe(path.normalize(targetReal));
        });
    });

    describe('other', () => {
        it('caches resolved import result and recomputes after clearCaches', () => {
            const root = mkTempProjectFromFixture('relative');
            const importer = path.join(root, 'src/feature/importer.ts');
            const tsTarget = path.join(root, 'src/utils/tool.ts');
            const jsTarget = path.join(root, 'src/utils/tool.js');

            const resolver = createImportResolver({ extensions: ['.ts', '.js'], resolveCacheTtl: 0 });

            const first = resolver.resolve({
                importerFile: importer,
                specifier: '../utils/tool',
            });

            expect(first).not.toBeNull();
            expect(first?.resolvedFile).toBe(path.normalize(tsTarget));

            fs.rmSync(tsTarget);

            const second = resolver.resolve({
                importerFile: importer,
                specifier: '../utils/tool',
            });

            expect(second).toBe(first);
            expect(second?.resolvedFile).toBe(path.normalize(tsTarget));

            clearAllCaches();

            const third = resolver.resolve({
                importerFile: importer,
                specifier: '../utils/tool',
            });

            expect(third).not.toBeNull();
            expect(third?.resolvedFile).toBe(path.normalize(jsTarget));
        });
    });
});
