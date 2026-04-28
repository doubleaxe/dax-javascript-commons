import { describe, expect, it } from 'vitest';

import { normalizePath } from '../src/normalizer.js';

describe('normalizePath', () => {
    it('normalizes relative paths and preserves the leading dot', () => {
        // Basic resolution
        expect(normalizePath('./utils/../another')).toBe('./another');
        expect(normalizePath('../utils/../helper')).toBe('../helper');

        // Deep nesting and multiple dots
        expect(normalizePath('./a/b/../../c')).toBe('./c');
        expect(normalizePath('./../foo')).toBe('./../foo');

        // Redundant segments
        expect(normalizePath('./././src/index.js')).toBe('./src/index.js');
    });

    it('does not collapse segments if they are alias-like (no leading dot/slash)', () => {
        // Here, #internal is protected. The .. cannot remove it.
        expect(normalizePath('#internal/../../utils')).toBe('#internal/../../utils');

        // Even if it looks like a folder, if it's a bare specifier, leave it alone
        expect(normalizePath('my-package/../other')).toBe('my-package/../other');

        expect(normalizePath('@org/components/button')).toBe('@org/components/button');
    });

    it('still cleans up internal redundant dots within an alias path', () => {
        // Clean up the noise, but keep the structure
        expect(normalizePath('@/./components//button')).toBe('@/components/button');
        expect(normalizePath('@//components///button')).toBe('@/components/button');
        expect(normalizePath('#internal//utils/./index.js')).toBe('#internal/utils/index.js');
        expect(normalizePath('my-package/ui/../button')).toBe('my-package/button');
    });

    it('only collapses ".." for explicit relative or absolute paths', () => {
        // Standard relative paths SHOULD still collapse
        expect(normalizePath('./a/../b')).toBe('./b');

        // Standard absolute paths SHOULD still collapse
        expect(normalizePath('/a/../b')).toBe('/b');
        expect(normalizePath('C:/a/../b')).toBe('C:/b');
    });

    it('collapses multiple slashes without affecting protocol/root', () => {
        expect(normalizePath('src//utils///file.ts')).toBe('src/utils/file.ts');
        expect(normalizePath('/root///dir')).toBe('/root/dir');

        // Edge case: Windows-style backslashes (should be normalized to forward)
        expect(normalizePath('src\\utils\\file.ts')).toBe('src/utils/file.ts');
    });

    it('handles preserve leading parent segments', () => {
        // Expected behavior: Returns "../../file.js"
        expect(normalizePath('../../file.js')).toBe('../../file.js');
    });

    it('normalizes rooted paths segment by segment', () => {
        expect(normalizePath('/foo/../bar')).toBe('/bar');
        expect(normalizePath('/a/b/c/../../../d')).toBe('/d');
    });

    it('handles case sensitivity toggle', () => {
        expect(normalizePath('@/Components/Button', true)).toBe('@/components/button');
        expect(normalizePath('@/Components/Button', false)).toBe('@/Components/Button');
    });

    it('handles extreme edge cases (Empty, Dot-only, Trailing)', () => {
        expect(normalizePath('')).toBe('.');
        expect(normalizePath('.')).toBe('.');
        expect(normalizePath('./')).toBe('./');
        expect(normalizePath('..')).toBe('..');
        expect(normalizePath('/')).toBe('/');

        // Trailing slashes (usually should be preserved if the user intended a directory)
        expect(normalizePath('./src/')).toBe('./src/');
    });

    it('normalizes Unix absolute paths', () => {
        expect(normalizePath('/usr/local/../bin//node')).toBe('/usr/bin/node');
        expect(normalizePath('/../../etc/passwd')).toBe('/etc/passwd'); // Root guard
    });

    it('normalizes Windows absolute paths to Unix-style', () => {
        // Basic drive letter
        expect(normalizePath('C:\\Users\\Admin\\..\\Guest')).toBe('C:/Users/Guest');

        // Mixed slashes and redundancy
        expect(normalizePath('D:/work//projects/./app')).toBe('D:/work/projects/app');

        // Lowercase drive letters (some tools normalize these to uppercase)
        expect(normalizePath('c:/test')).toBe('c:/test');
        expect(normalizePath('c:/test/../../')).toBe('c:/');
    });

    it('normalizes Windows UNC paths to Unix-style', () => {
        expect(normalizePath('/////server/share')).toBe('//server/share');
        expect(normalizePath('\\\\\\server/share')).toBe('//server/share');
        expect(normalizePath('//server///share//file')).toBe('//server/share/file');
    });

    it('handles absolute paths with case-insensitivity toggle', () => {
        expect(normalizePath('C:/Users/ADMIN', true)).toBe('c:/users/admin');
    });
});
