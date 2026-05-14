import * as fs from 'node:fs';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { clearAllCaches, createImportResolver } from '../src/resolve.js';
import { useTempFiles } from './util.js';

const { mkTempProjectFromFixture, cleanupTempDirs } = useTempFiles('resolve-test-');

afterEach(() => {
    cleanupTempDirs();
    clearAllCaches();
});

describe('resolve', () => {
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
