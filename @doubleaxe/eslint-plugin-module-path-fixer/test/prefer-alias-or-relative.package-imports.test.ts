import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { clearAllCaches } from '../src/resolve.js';
import { createPreferAliasOrRelativeCore } from '../src/rules/prefer-alias-or-relative/index.js';
import { useTempFiles } from './util.js';

const { gatLocalProjectFromFixture, cleanupTempDirs } = useTempFiles('extensions-core-test-');

afterEach(() => {
    cleanupTempDirs();
    clearAllCaches();
});

describe('prefer-alias-or-relative.tsconfig', () => {
    it('depth optimization strategy', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');
        const subImporter = path.join(root, 'src/feature/subfolder/importer.ts');

        let core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'none',
        });

        let result = core.evaluate({
            importerFile: subImporter,
            specifier: '../../utils/tool.js',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('#app/utils/tool.js');

        result = core.evaluate({
            importerFile: subImporter,
            specifier: '../relative',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBeUndefined();

        result = core.evaluate({
            importerFile: subImporter,
            specifier: '../../components/ext/index.js',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('#components/ext/index.js');

        result = core.evaluate({
            importerFile: subImporter,
            specifier: '../../components/ext',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('#components/ext');

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBeUndefined();

        result = core.evaluate({
            importerFile: importer,
            specifier: '#app/utils/tool',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBe('../utils/tool');

        result = core.evaluate({
            importerFile: importer,
            specifier: '#app/utils/tool.ts',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBe('../utils/tool.ts');

        result = core.evaluate({
            importerFile: importer,
            specifier: '#app/feature/relative.js',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBe('./relative.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '#app/feature/subfolder/importer',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBe('./subfolder/importer');

        core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'none',
            maxChildFolderSegments: 0,
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: './relative',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('#app/feature/relative');

        core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'none',
            maxParentSegments: 1,
            useTotalParentSegments: true,
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('#app/utils/tool');
    });

    it('shorter optimization strategy', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        let core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'shorter',
        });

        let result = core.evaluate({
            importerFile: importer,
            specifier: './relative.js',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBeUndefined();

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBeUndefined();

        result = core.evaluate({
            importerFile: importer,
            specifier: '../components/ext.js',
        });

        expect(result?.kind).toBe('alias-optimized');
        expect(result?.nextSpecifier).toBe('#components/ext.js');

        core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'shorterEqual',
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool',
        });

        expect(result?.kind).toBe('alias-optimized');
        expect(result?.nextSpecifier).toBe('#app/utils/tool');
    });

    it('direct aliases', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        let core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js', '.mjs'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'shorter',
            usePackageJson: ['package-base-values.json'],
        });

        let result = core.evaluate({
            importerFile: importer,
            specifier: '../components/base/value.js',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBeUndefined();

        result = core.evaluate({
            importerFile: importer,
            specifier: '../components/base/value',
        });

        expect(result?.kind).toBe('alias-optimized');
        expect(result?.nextSpecifier).toBe('#base-value');

        result = core.evaluate({
            importerFile: importer,
            specifier: '../components/base/index',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBeUndefined();

        result = core.evaluate({
            importerFile: importer,
            specifier: '../components/base',
        });

        expect(result?.kind).toBe('alias-optimized');
        expect(result?.nextSpecifier).toBe('#base');

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool.js',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBeUndefined();

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool.mjs',
        });

        expect(result?.kind).toBe('alias-optimized');
        expect(result?.nextSpecifier).toBe('#tool');

        core = createPreferAliasOrRelativeCore({
            extensions: ['.js', '.mjs'],
            extensionAlias: { '.mjs': '.js' },
            optimization: 'shorter',
            usePackageJson: ['package-base-values.json'],
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool.js',
        });

        expect(result?.kind).toBe('alias-optimized');
        expect(result?.nextSpecifier).toBe('#tool');
    });

    it('shorter alias wins', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'none',
            maxParentSegments: 0,
        });

        let result = core.evaluate({
            importerFile: importer,
            specifier: '#app/components/base/value.js',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('#components/base/value.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '#components/../utils/tool.js',
        });

        // TODO
        expect(result?.kind).toBe('unresolved');
    });

    it('alias for patterns', () => {
        const root = gatLocalProjectFromFixture('package-imports');
        const importer = path.join(root, 'src/feature/importer.ts');

        let core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'none',
            maxParentSegments: 0,
            usePackageJson: ['package-base-patterns.json'],
        });

        let result = core.evaluate({
            importerFile: importer,
            specifier: '../components/base/value.mjs',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('#base-any/value');

        result = core.evaluate({
            importerFile: importer,
            specifier: '../components/base/value.js',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('#base/value.js');

        core = createPreferAliasOrRelativeCore({
            extensions: ['.mjs'],
            extensionAlias: { '.mjs': '.js' },
            optimization: 'none',
            maxParentSegments: 0,
            usePackageJson: ['package-base-patterns.json'],
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '../components/base/value',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('#base-any/value');
    });
});
