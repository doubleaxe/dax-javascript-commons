import * as path from 'node:path/posix';

import type { FileSystem } from '../fscache.js';
import { stripBom } from '../util.js';
import type { AliasEntry, PackageJsonContent } from './types.js';

const PREFERRED_CONDITIONS = new Set(['browser', 'default', 'import', 'module-sync', 'node', 'require']);

function collectImportTargets(value: unknown): string[] {
    if (value === null || value === undefined) {
        return [];
    }

    if (typeof value === 'string') {
        return [value];
    }

    if (Array.isArray(value)) {
        return [...new Set(value.flatMap((entry) => collectImportTargets(entry)))];
    }

    if (value && typeof value === 'object') {
        const conditions = value as Record<string, unknown>;

        const entries = Object.entries(conditions);
        for (const [key, target] of entries) {
            if (PREFERRED_CONDITIONS.has(key)) {
                return collectImportTargets(target);
            }
        }

        return collectImportTargets(entries[0]?.[1]);
    }

    return [];
}

export function buildPackageImportAliases(fileSystem: FileSystem, fileName: string): AliasEntry | null {
    const raw = fileSystem.readFileSync(fileName, 'utf8');
    const packageJson = JSON.parse(stripBom(raw)) as PackageJsonContent;

    const imports = packageJson.imports;
    if (!imports || typeof imports !== 'object') {
        return null;
    }

    const paths: Record<string, string[]> = {};
    for (const [specifier, targetConfig] of Object.entries(imports)) {
        if (!specifier.startsWith('#')) {
            continue;
        }

        const targets = collectImportTargets(targetConfig).filter((target) => target);

        if (targets.length > 0) {
            paths[specifier] = targets;
        }
    }

    if (Object.keys(paths).length === 0) {
        return null;
    }

    return {
        // path is normalized
        baseUrl: path.dirname(fileName),
        paths,
        source: 'package',
    };
}
