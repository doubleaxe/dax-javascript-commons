import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createExtensionsCore } from '../src/rules/extensions/index.js';

const tempRoots: string[] = [];
const fixturesRoot = path.resolve(process.cwd(), 'test-assets');

function mkTempRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'extensions-core-test-'));
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

describe('ExtensionsCore', () => {
    it('adds mapped import extension when extension mode is always', () => {
        const root = mkTempProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createExtensionsCore({
            extension: 'always',
            index: 'never',
            extensions: ['.ts', '.js'],
            extensionMapping: { ts: 'js' },
        });

        const result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/helper',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('rewrite');
        expect(result?.reason).toBe('extension');
        expect(result?.nextSpecifier).toBe('../utils/helper.js');
    });

    it('removes explicit extension when extension mode is never', () => {
        const root = mkTempProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createExtensionsCore({
            extension: 'never',
            index: 'never',
            extensions: ['.ts'],
        });

        const result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/helper.ts',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('rewrite');
        expect(result?.reason).toBe('extension');
        expect(result?.nextSpecifier).toBe('../utils/helper');
    });

    it('adds index segment and mapped extension when both modes are always', () => {
        const root = mkTempProjectFromFixture('imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createExtensionsCore({
            extension: 'always',
            index: 'always',
            extensions: ['.ts', '.js'],
            extensionMapping: { ts: 'js' },
        });

        const result = core.evaluate({
            importerFile: importer,
            specifier: '../core',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('rewrite');
        expect(result?.reason).toBe('extension-and-index');
        expect(result?.nextSpecifier).toBe('../core/index.js');
    });

    it('removes index segment when index mode is never and rewrite is safe', () => {
        const root = mkTempProjectFromFixture('imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createExtensionsCore({
            extension: 'never',
            index: 'never',
            extensions: ['.ts'],
        });

        const result = core.evaluate({
            importerFile: importer,
            specifier: '../core/index.ts',
        });

        expect(result).not.toBeNull();
        expect(result?.kind).toBe('rewrite');
        expect(result?.reason).toBe('extension-and-index');
        expect(result?.nextSpecifier).toBe('../core');
    });

    it('skips index removal when it would resolve to a different file', () => {
        const root = mkTempProjectFromFixture('extensions-ambiguous');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createExtensionsCore({
            extension: 'never',
            index: 'never',
            extensions: ['.ts'],
        });

        const result = core.evaluate({
            importerFile: importer,
            specifier: '../core/index.ts',
        });

        expect(result).toBeNull();
    });

    it('ignores unresolved imports', () => {
        const root = mkTempProjectFromFixture('relative');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createExtensionsCore({
            extension: 'never',
            index: 'never',
            extensions: ['.ts'],
        });

        const result = core.evaluate({
            importerFile: importer,
            specifier: 'react',
        });

        expect(result).toBeNull();
    });
});
