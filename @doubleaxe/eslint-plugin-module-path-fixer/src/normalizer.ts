import * as path from 'node:path';

export function normalizePath(value: string, caseInsensitive?: boolean): string {
    const p = value.replaceAll('\\', '/');
    let processed = p.replace(/\/+/g, '/');

    if (!processed || processed === '' || processed === '.') {
        return '.';
    }
    const slash = processed.indexOf('/');
    if (slash < 0 || slash === processed.length - 1) {
        return processed;
    }

    let root = '';
    if (processed.startsWith('./')) {
        root = './';
        processed = processed.slice(2);
    } else if (processed.startsWith('../')) {
        // Leave as is, standard normalize handles leading .. for relative paths
    } else if (p.startsWith('//')) {
        // UNC Path or Protocol, Restore the double slash lost by the regex
        root = '//';
        processed = processed.slice(1);
    } else if (processed.startsWith('/')) {
        // POSIX absolute paths will be handled correctly
    } else if (/^[A-Za-z]:/.test(processed)) {
        // Windows Drive Letter (e.g., C:/ or C:)
        root = processed.slice(0, 2);
        processed = processed.slice(root.length);
    } else {
        // Alias/Module - Keep the first segment as the root
        root = processed.slice(0, slash + 1);
        processed = processed.slice(slash + 1);
    }

    let remainder = path.posix.normalize(processed);
    if (remainder === '.' || remainder === './') remainder = '';

    let normalized = root + remainder;
    if (p.endsWith('/') && !normalized.endsWith('/') && normalized !== root) {
        normalized += '/';
    }

    return caseInsensitive ? normalized.toLowerCase() : normalized;
}
