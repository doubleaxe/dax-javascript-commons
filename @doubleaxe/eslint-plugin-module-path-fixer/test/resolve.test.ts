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

        const resolver = createImportResolver({ extensions: ['.ts'] });
        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../utils/helper',
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

        const resolver = createImportResolver({ extensions: ['.ts'] });
        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '@app/utils/tool',
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

        const resolver = createImportResolver({ extensions: ['.ts'] });
        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '#core',
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
        expect(resolved?.strategy).toBe('tsconfig-paths');
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('respects useTsConfig and usePackageJson flags', () => {
        const aliasRoot = mkTempProjectFromFixture('alias');
        const aliasImporter = path.join(aliasRoot, 'src/feature/importer.ts');

        const aliasResolver = createImportResolver({ extensions: ['.ts'], useTsConfig: false });
        const aliasResolved = aliasResolver.resolve({
            importerFile: aliasImporter,
            specifier: '@app/utils/tool',
        });

        expect(aliasResolved).toBeNull();

        const importsRoot = mkTempProjectFromFixture('imports');
        const importsImporter = path.join(importsRoot, 'src/feature/importer.ts');

        const importsResolver = createImportResolver({ extensions: ['.ts'], usePackageJson: false });
        const importsResolved = importsResolver.resolve({
            importerFile: importsImporter,
            specifier: '#core',
        });

        expect(importsResolved).toBeNull();
    });

    it('resolves manual tsconfig entries even when useTsConfig is disabled', () => {
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
        expect(resolved?.strategy).toBe('tsconfig-paths');
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
        expect(resolved?.strategy).toBe('tsconfig-paths');
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

        resolver.clearCaches();

        const third = resolver.resolve({
            importerFile: importer,
            specifier: '../core/value',
        });

        expect(third).not.toBeNull();
        expect(third?.resolvedFile).toBe(path.normalize(jsTarget));
    });

    it('resolves relative imports case-insensitively when caseInsensitive is enabled', () => {
        const root = mkTempProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');
        const target = path.join(root, 'src/utils/helper.ts');

        const resolver = createImportResolver({ caseInsensitive: true, extensions: ['.ts'] });
        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../Utils/Helper',
        });

        expect(resolved).not.toBeNull();
        expect(resolved?.resolvedFile).toBe(path.normalize(target));
    });

    it('does not resolve relative imports case-insensitively when caseInsensitive is disabled', () => {
        const root = mkTempProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');

        const resolver = createImportResolver({ caseInsensitive: false, extensions: ['.ts'] });
        const resolved = resolver.resolve({
            importerFile: importer,
            specifier: '../Utils/Helper',
        });

        expect(resolved).toBeNull();
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
