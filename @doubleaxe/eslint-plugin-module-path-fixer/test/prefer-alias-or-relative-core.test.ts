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

afterEach(() => {
    while (tempRoots.length > 0) {
        const root = tempRoots.pop();
        if (root) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }
});

describe('PreferAliasOrRelativeCore', () => {
    it('converts deep relative specifier to tsconfig alias when above depth', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ depth: 0, extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-alias');
        expect(result?.nextSpecifier).toBe('@app/utils/tool');
    });

    it('does not convert relative specifier when traversal depth is allowed', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ depth: 1, extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool',
        });

        expect(result).toBeNull();
    });

    it('converts alias to shortest stable relative path when depth allows it', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ depth: 1, extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '@app/utils/tool',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-relative');
        expect(result?.nextSpecifier).toBe('../utils/tool');
    });

    it('does not convert alias to relative when traversal depth exceeds allowed threshold', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ depth: 0, extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '@app/utils/tool',
        });

        expect(result).toBeNull();
    });

    it('treats negative depth as always prefer relative', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ depth: -1, extensions: ['.ts'] });
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

        const core = createPreferAliasOrRelativeCore({ depth: 0, extensions: ['.ts'] });
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

        const core = createPreferAliasOrRelativeCore({ depth: 1, extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '#core',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-relative');
        expect(result?.nextSpecifier).toBe('../core');
    });

    it('supports manual alias mappings', () => {
        const root = mkTempProjectFromFixture('manual');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({
            depth: 0,
            extensions: ['.ts'],
            manualTsConfigs: [{ baseUrl: root, paths: { '@manual/*': ['src/*'] } }],
            useTsConfig: false,
        });
        const result = core.evaluate({
            importerFile: importer,
            specifier: '../shared/tool',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('to-alias');
        expect(result?.nextSpecifier).toBe('@manual/shared/tool');
    });

    it('ignores unresolved imports', () => {
        const root = mkTempProjectFromFixture('alias');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({ depth: 1, extensions: ['.ts'] });
        const result = core.evaluate({
            importerFile: importer,
            specifier: 'react',
        });

        expect(result).toBeNull();
    });
});
