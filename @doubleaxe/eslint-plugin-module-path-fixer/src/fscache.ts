import * as fs from 'node:fs';

import { LRUCache } from 'lru-cache';

type StatSync = typeof fs.statSync;
export type FileSystem = Pick<typeof fs, 'readFileSync' | 'statSync'>;

type FsCacheOptions = {
    fs?: FileSystem;
    max?: number;
    ttl?: number;
};

type StatCacheValue =
    | {
          kind: 'error';
          value: NodeJS.ErrnoException;
      }
    | {
          kind: 'success';
          value: ReturnType<StatSync>;
      };

export type CachedFs = {
    clearCache: () => void;
} & FileSystem;

function cloneFsError(error: NodeJS.ErrnoException): NodeJS.ErrnoException {
    const next = new Error(error.message) as NodeJS.ErrnoException;
    next.name = error.name;
    next.code = error.code;
    next.errno = error.errno;
    next.path = error.path;
    next.stack = error.stack;
    next.syscall = error.syscall;
    return next;
}

export function createFsCache(options: FsCacheOptions = {}): CachedFs {
    const sourceFs = options.fs ?? fs;
    const statCache = new LRUCache<string, StatCacheValue>({
        max: options.max ?? 5_000,
        ttl: options.ttl ?? 5_000,
    });

    function statSync(...args: Parameters<StatSync>): ReturnType<StatSync> {
        const [filePath] = args;
        const cacheKey = typeof filePath === 'string' ? filePath : filePath.toString();
        const cached = statCache.get(cacheKey);

        if (cached) {
            if (cached.kind === 'error') {
                throw cloneFsError(cached.value);
            }
            return cached.value;
        }

        try {
            const result = sourceFs.statSync(...args);
            statCache.set(cacheKey, { kind: 'success', value: result });
            return result;
        } catch (error) {
            if (error instanceof Error) {
                statCache.set(cacheKey, { kind: 'error', value: error as NodeJS.ErrnoException });
            }
            throw error;
        }
    }

    return {
        statSync: statSync as StatSync,
        readFileSync: sourceFs.readFileSync,
        clearCache() {
            statCache.clear();
        },
    };
}

export function fileExists(fileSystem: FileSystem, filePath: string) {
    try {
        if (fileSystem.statSync(filePath).isFile()) return true;
    } catch {
        /**/
    }
    return false;
}

export function dirExists(fileSystem: FileSystem, filePath: string) {
    try {
        if (fileSystem.statSync(filePath).isDirectory()) return true;
    } catch {
        /**/
    }
    return false;
}
