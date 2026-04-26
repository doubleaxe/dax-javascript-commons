import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createImportResolver } from '../src/resolve.js';

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
});

describe('ImportResolver', () => {
    it('resolves relative imports', () => {
        const root = mkTempProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');
        const target = path.join(root, 'src/utils/helper.ts');

        const resolver = createImportResolver();
        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../utils/helper',
            extensions: ['.ts'],
        });

        expect(resolved).not.toBeNull();
        expect(resolved?.strategy).toBe('relative');
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('resolves aliases via nearest tsconfig paths and caches nearest config', () => {
        const root = mkTempProjectFromFixture('alias');
        const tsconfigPath = path.join(root, 'tsconfig.json');
        const importer = path.join(root, 'src/feature/importer.ts');
        const siblingFile = path.join(root, 'src/feature/another.ts');
        const target = path.join(root, 'src/utils/tool.ts');

        const resolver = createImportResolver();
        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@app/utils/tool',
            extensions: ['.ts'],
        });

        expect(resolved).not.toBeNull();
        expect(resolved?.strategy).toBe('tsconfig-paths');
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
        expect(resolved?.tsJsConfig?.path).toBe(path.normalize(tsconfigPath));

        const nearestA = resolver.getNearestTsJsConfig(importer);
        const nearestB = resolver.getNearestTsJsConfig(siblingFile);

        expect(nearestA).not.toBeNull();
        expect(nearestA).toBe(nearestB);
        expect(nearestA?.raw).toContain('"paths"');
    });

    it('resolves #imports via nearest package.json imports and caches package location', () => {
        const root = mkTempProjectFromFixture('imports');
        const packageJsonPath = path.join(root, 'package.json');
        const importer = path.join(root, 'src/feature/importer.ts');
        const siblingFile = path.join(root, 'src/feature/another.ts');
        const target = path.join(root, 'src/core/index.ts');

        const resolver = createImportResolver();
        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#core',
            extensions: ['.ts'],
        });

        expect(resolved).not.toBeNull();
        expect(resolved?.strategy).toBe('package-imports');
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
        expect(resolved?.packageJson?.path).toBe(path.normalize(packageJsonPath));

        const nearestA = resolver.getNearestPackageJson(importer);
        const nearestB = resolver.getNearestPackageJson(siblingFile);

        expect(nearestA).not.toBeNull();
        expect(nearestA).toBe(nearestB);
        expect(nearestA?.raw).toContain('"imports"');
    });

    it('resolves manual tsconfig aliases from resolver options', () => {
        const root = mkTempProjectFromFixture('manual');
        const importer = path.join(root, 'src/feature/importer.ts');
        const target = path.join(root, 'src/shared/tool.ts');

        const resolver = createImportResolver({
            manualTsConfigs: [{ baseUrl: root, paths: { '@manual/*': ['src/*'] } }],
        });

        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@manual/shared/tool',
            extensions: ['.ts'],
        });

        expect(resolved).not.toBeNull();
        expect(resolved?.strategy).toBe('tsconfig-paths');
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('respects useTsConfig and usePackageJson flags', () => {
        const aliasRoot = mkTempProjectFromFixture('alias');
        const aliasImporter = path.join(aliasRoot, 'src/feature/importer.ts');

        const aliasResolver = createImportResolver({ useTsConfig: false });
        const aliasResolved = aliasResolver.resolve({
            importerFile: aliasImporter,
            specifier: '@app/utils/tool',
            extensions: ['.ts'],
        });

        expect(aliasResolved).toBeNull();

        const importsRoot = mkTempProjectFromFixture('imports');
        const importsImporter = path.join(importsRoot, 'src/feature/importer.ts');

        const importsResolver = createImportResolver({ usePackageJson: false });
        const importsResolved = importsResolver.resolve({
            importerFile: importsImporter,
            specifier: '#core',
            extensions: ['.ts'],
        });

        expect(importsResolved).toBeNull();
    });

    it('resolves manual tsconfig entries even when useTsConfig is disabled', () => {
        const root = mkTempProjectFromFixture('manual');
        const importer = path.join(root, 'src/feature/importer.ts');
        const target = path.join(root, 'src/shared/tool.ts');

        const resolver = createImportResolver({
            useTsConfig: false,
            manualTsConfigs: [{ baseUrl: root, paths: { '@manual/*': ['src/*'] } }],
        });

        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@manual/shared/tool',
            extensions: ['.ts'],
        });

        expect(resolved).not.toBeNull();
        expect(resolved?.strategy).toBe('tsconfig-paths');
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('resolves using matching entry from multiple manualTsConfigs', () => {
        const root = mkTempProjectFromFixture('manual');
        const importer = path.join(root, 'src/feature/importer.ts');
        const target = path.join(root, 'src/shared/tool.ts');

        const resolver = createImportResolver({
            manualTsConfigs: [
                { baseUrl: root, paths: { '@other/*': ['src/other/*'] } },
                { baseUrl: root, paths: { '@manual/*': ['src/*'] } },
            ],
        });

        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@manual/shared/tool',
            extensions: ['.ts'],
        });

        expect(resolved).not.toBeNull();
        expect(resolved?.strategy).toBe('tsconfig-paths');
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('caches resolved import result and recomputes after clearCaches', () => {
        const root = mkTempProjectFromFixture('cache');
        const importer = path.join(root, 'src/feature/importer.ts');
        const tsTarget = path.join(root, 'src/utils/value.ts');
        const jsTarget = path.join(root, 'src/utils/value.js');

        const resolver = createImportResolver();

        const first = resolver.resolve({
            importerFile: importer,
            specifier: '../utils/value',
            extensions: ['.ts', '.js'],
        });

        expect(first).not.toBeNull();
        expect(first?.resolvedFile).toBe(path.normalize(tsTarget));

        fs.rmSync(tsTarget);

        const second = resolver.resolve({
            importerFile: importer,
            specifier: '../utils/value',
            extensions: ['.ts', '.js'],
        });

        expect(second).toBe(first);
        expect(second?.resolvedFile).toBe(path.normalize(tsTarget));

        resolver.clearCaches();

        const third = resolver.resolve({
            importerFile: importer,
            specifier: '../utils/value',
            extensions: ['.ts', '.js'],
        });

        expect(third).not.toBeNull();
        expect(third?.resolvedFile).toBe(path.normalize(jsTarget));
    });

    it('resolves relative imports case-insensitively when caseInsensitive is enabled', () => {
        const root = mkTempProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');
        const target = path.join(root, 'src/utils/helper.ts');

        const resolver = createImportResolver({ caseInsensitive: true });
        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../Utils/Helper',
            extensions: ['.ts'],
        });

        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('does not resolve relative imports case-insensitively when caseInsensitive is disabled', () => {
        const root = mkTempProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({ caseInsensitive: false });
        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../Utils/Helper',
            extensions: ['.ts'],
        });

        expect(resolved).toBeNull();
    });

    it('resolves imports through directory symlink', () => {
        const root = mkTempRoot();

        const realDir = path.join(root, 'real');
        fs.mkdirSync(realDir, { recursive: true });
        fs.writeFileSync(path.join(realDir, 'target.ts'), 'export const value = 1;');

        const linkDir = path.join(root, 'link');
        fs.symlinkSync(realDir, linkDir, 'dir');

        const importerFile = path.join(root, 'importer.ts');
        fs.writeFileSync(importerFile, "import { value } from './link/target';");

        const resolver = createImportResolver();
        const resolved = resolver.resolve({
            importerFile,
            specifier: './link/target',
            extensions: ['.ts'],
        });

        expect(resolved).not.toBeNull();
        const resolvedRealPath = fs.realpathSync(resolved!.resolvedFile);
        expect(resolvedRealPath).toBe(path.normalize(path.join(realDir, 'target.ts')));
    });
});
