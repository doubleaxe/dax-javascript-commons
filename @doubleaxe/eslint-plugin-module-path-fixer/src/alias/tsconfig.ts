import path from 'node:path/posix';

import JSON5 from 'json5';

import { fileExists, type FileSystem } from '../fscache.js';
import { normalizePath } from '../normalizer.js';
import { stripBom } from '../util.js';
import type { AliasEntry, TsConfigContent } from './types.js';

function loadTsconfig(fileSystem: FileSystem, configFilePath: string): TsConfigContent {
    const configString = fileSystem.readFileSync(configFilePath, 'utf8');
    let config: TsConfigContent;
    try {
        config = JSON5.parse(stripBom(configString));
    } catch (e) {
        throw new Error(`${configFilePath} is malformed ${(e as Error).message}`);
    }

    const extendedConfig = config.extends;
    if (extendedConfig) {
        let base: TsConfigContent;

        if (Array.isArray(extendedConfig)) {
            base = extendedConfig.reduce(
                (currBase, extendedConfigElement) =>
                    mergeTsconfigs(
                        currBase,
                        loadTsconfigFromExtends(fileSystem, configFilePath, extendedConfigElement)
                    ),
                {}
            );
        } else {
            base = loadTsconfigFromExtends(fileSystem, configFilePath, extendedConfig);
        }

        return mergeTsconfigs(base, config);
    }
    return config;
}

function loadTsconfigFromExtends(
    fileSystem: FileSystem,
    configFilePath: string,
    extendedConfigValue: string
): TsConfigContent {
    if (!(typeof extendedConfigValue === 'string')) return {};

    if (!extendedConfigValue.endsWith('.json')) {
        extendedConfigValue += '.json';
    }
    const currentDir = path.dirname(configFilePath);
    let extendedConfigPath = path.join(currentDir, extendedConfigValue);
    if (!fileExists(fileSystem, extendedConfigPath)) {
        // TODO - support loading from node_modules??
        return {};
    }

    extendedConfigPath = normalizePath(extendedConfigPath);
    const config = loadTsconfig(fileSystem, extendedConfigPath);

    if (config.compilerOptions?.baseUrl) {
        const extendsDir = path.dirname(extendedConfigPath);
        config.compilerOptions.absoluteBaseUrl = path.join(extendsDir, config.compilerOptions.baseUrl);
    }

    return config;
}

function mergeTsconfigs(base: TsConfigContent | undefined, config: TsConfigContent | undefined): TsConfigContent {
    base = base ?? {};
    config = config ?? {};

    return {
        ...base,
        ...config,
        compilerOptions: {
            ...base.compilerOptions,
            ...config.compilerOptions,
        },
    };
}

export function buildTsconfigAliases(fileSystem: FileSystem, fileName: string): AliasEntry | null {
    const loaded = loadTsconfig(fileSystem, fileName);
    const paths = loaded.compilerOptions?.paths;
    if (!paths) return null;

    const dirName = path.dirname(fileName);
    const baseUrl = normalizePath(
        loaded.compilerOptions?.absoluteBaseUrl ??
            (loaded.compilerOptions?.baseUrl ? path.join(dirName, loaded.compilerOptions?.baseUrl) : undefined) ??
            dirName
    );

    return {
        baseUrl,
        paths,
        source: 'tsconfig',
    };
}
