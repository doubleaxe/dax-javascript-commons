import { afterEach, describe, it } from 'vitest';

import { clearAllCaches } from '../src/resolve.js';
import { useTempFiles } from './util.js';

const { cleanupTempDirs } = useTempFiles('extensions-core-test-');

afterEach(() => {
    cleanupTempDirs();
    clearAllCaches();
});

describe('prefer-alias-or-relative', () => {
    it('', () => {});
});
