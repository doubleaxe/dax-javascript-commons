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
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');
        const subImporter = path.join(root, 'src/feature/subfolder/importer.ts');

        let core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'none',
        });

        let result = core.evaluate({
            importerFile: subImporter,
            specifier: '../../components/base/value',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('@base/value');

        result = core.evaluate({
            importerFile: subImporter,
            specifier: '../relative',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBeUndefined();

        result = core.evaluate({
            importerFile: subImporter,
            specifier: '../../components/base/index.js',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('@base/index.js');

        result = core.evaluate({
            importerFile: subImporter,
            specifier: '../../components/base',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('@components/base');

        result = core.evaluate({
            importerFile: subImporter,
            specifier: '../../components/base/',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('@components/base/');

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBeUndefined();

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/utils/tool',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBe('../utils/tool');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/utils/tool.ts',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBe('../utils/tool.ts');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/relative.js',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBe('./relative.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@app/feature/subfolder/importer',
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
        expect(result?.nextSpecifier).toBe('@app/feature/relative');

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
        expect(result?.nextSpecifier).toBe('@app/utils/tool');
    });

    it('shorter optimization strategy', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
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
        expect(result?.nextSpecifier).toBe('@components/ext.js');

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
        expect(result?.nextSpecifier).toBe('@app/utils/tool');
    });

    it('direct aliases', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        let core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'shorter',
            useTsConfig: 'tsconfig-files.json',
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
        expect(result?.nextSpecifier).toBe('$base-value');

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
        expect(result?.nextSpecifier).toBe('$base');

        core = createPreferAliasOrRelativeCore({
            extensions: ['.js'],
            extensionAlias: {},
            optimization: 'shorter',
            useTsConfig: 'tsconfig-files-ext.json',
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool.ts',
        });

        expect(result?.kind).toBe('relative');
        expect(result?.nextSpecifier).toBeUndefined();

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool.js',
        });

        expect(result?.kind).toBe('alias-optimized');
        expect(result?.nextSpecifier).toBe('$tool');

        core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'shorter',
            useTsConfig: 'tsconfig-files-ext.json',
        });

        result = core.evaluate({
            importerFile: importer,
            specifier: '../utils/tool.js',
        });

        expect(result?.aliasReason).toBe('unsafe');
    });

    it('shorter alias wins', () => {
        const root = gatLocalProjectFromFixture('tsconfig');
        const importer = path.join(root, 'src/feature/importer.ts');

        const core = createPreferAliasOrRelativeCore({
            extensions: ['.ts', '.js'],
            extensionAlias: { '.ts': '.js' },
            optimization: 'none',
            maxParentSegments: 0,
        });

        let result = core.evaluate({
            importerFile: importer,
            specifier: '@app/components/base/value.js',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('@base/value.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/base/value.js',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('@base/value.js');

        result = core.evaluate({
            importerFile: importer,
            specifier: '@components/../utils/tool.js',
        });

        expect(result?.kind).toBe('alias-depth');
        expect(result?.nextSpecifier).toBe('@app/utils/tool.js');
    });
});
