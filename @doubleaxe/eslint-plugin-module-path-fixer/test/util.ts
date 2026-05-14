import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export function useTempFiles(testName: string) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const tempRoots: string[] = [];
    const fixturesRoot = path.resolve(__dirname, '..', 'test-assets');

    function mkTempRoot(): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), testName));
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

    function gatLocalProjectFromFixture(fixtureName: string): string {
        const fixturePath = path.join(fixturesRoot, fixtureName);
        return fixturePath;
    }

    function cleanupTempDirs(): void {
        while (tempRoots.length > 0) {
            const root = tempRoots.pop();
            if (root) {
                fs.rmSync(root, { recursive: true, force: true });
            }
        }
    }

    return {
        fixturesRoot,
        mkTempRoot,
        copyDirectoryRecursive,
        mkTempProjectFromFixture,
        gatLocalProjectFromFixture,
        cleanupTempDirs,
    };
}
