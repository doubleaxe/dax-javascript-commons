import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createPreferAliasOrRelativeCore } from '../src/rules/prefer-alias-or-relative/index.js';

const tempRoots: string[] = [];
const fixturesRoot = path.resolve(process.cwd(), 'test-assets');

function mkTempRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prefer-alias-or-relative-test-'));
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

function writeFile(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
}

afterEach(() => {
    while (tempRoots.length > 0) {
        const root = tempRoots.pop();
        if (root) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }
});

describe('PreferAliasOrRelativeCore', () => {
    it('converts parent relative specifier to tsconfig alias by default', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-alias');
        expect(result?.nextSpecifier).toBe('@app/utils/tool');
    });

    it('normalizes relative path before alias decision', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/../utils/tool',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-alias');
        expect(result?.nextSpecifier).toBe('@app/utils/tool');
    });

    it('does not convert local relative specifier', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: './another',
        });

        expect(result).toBeNull();
    });

    it('supports parentFolderAliasDepth threshold', () => {
        const root = mkTempRoot();
        const importer = path.join(root, 'src/rr/feature/importer.ts');
        writeFile(importer, 'export {};');
        writeFile(path.join(root, 'src/rr/ff/qq.ts'), 'export const qq = 1;');

        const core = createPreferAliasOrRelativeCore({
            extensions: ['.ts'],
            preferFolderAlias: false,
            parentFolderAliasDepth: 1,
            manualTsConfigs: [{ baseUrl: root, paths: { '@root/*': ['src/*'] } }],
            useTsConfig: false,
        });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '../ff/qq',
        });

        expect(result).toBeNull();
    });

    it('does not convert parent relative path when parentFolderAliasDepth is negative', () => {
        const root = mkTempRoot();
        const importer = path.join(root, 'src/rr/feature/importer.ts');
        writeFile(importer, 'export {};');
        writeFile(path.join(root, 'src/rr/ff/qq.ts'), 'export const qq = 1;');

        const core = createPreferAliasOrRelativeCore({
            extensions: ['.ts'],
            preferFolderAlias: false,
            parentFolderAliasDepth: -1,
            manualTsConfigs: [{ baseUrl: root, paths: { '@root/*': ['src/*'] } }],
            useTsConfig: false,
        });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '../ff/qq',
        });

        expect(result).toBeNull();
    });

    it('finds nearest alias to parent folder when preferFolderAlias is false', () => {
        const root = mkTempRoot();
        const importer = path.join(root, 'src/rr/feature/importer.ts');
        writeFile(importer, 'export {};');
        writeFile(path.join(root, 'src/rr/ff/qq.ts'), 'export const qq = 1;');

        const core = createPreferAliasOrRelativeCore({
            extensions: ['.ts'],
            preferFolderAlias: false,
            parentFolderAliasDepth: 0,
            manualTsConfigs: [{ baseUrl: root, paths: { '@root/*': ['src/*'] } }],
            useTsConfig: false,
        });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '../ff/qq',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-alias');
        expect(result?.nextSpecifier).toBe('@root/rr/ff/qq');
    });

    it('prefers alias found by folder-backward walk by default', () => {
        const root = mkTempRoot();
        const importer = path.join(root, 'src/rr/feature/importer.ts');
        writeFile(importer, 'export {};');
        writeFile(path.join(root, 'src/rr/ff/qq.ts'), 'export const qq = 1;');

        const core = createPreferAliasOrRelativeCore({
            extensions: ['.ts'],
            manualTsConfigs: [{ baseUrl: root, paths: { '@root/*': ['src/*'], '@rr/*': ['src/rr/*'] } }],
            useTsConfig: false,
        });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '../ff/qq',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-alias');
        expect(result?.nextSpecifier).toBe('@rr/ff/qq');
    });

    it('converts alias to shortest stable relative path', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '@app/utils/tool',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-relative');
        expect(result?.nextSpecifier).toBe('../utils/tool');
    });

    it('converts relative import to package imports alias when available', () => {
        const root = mkTempProjectFromFixture('imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '../core',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-alias');
        expect(result?.nextSpecifier).toBe('#core');
    });

    it('converts package imports alias to shortest relative path', () => {
        const root = mkTempProjectFromFixture('imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '#core',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-relative');
        expect(result?.nextSpecifier).toBe('../core');
    });

    it('ignores unresolved imports', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: 'react',
        });

        expect(result).toBeNull();
    });
});
