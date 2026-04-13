import type { EslintConfig } from './types.js';

const utils = {
    extendFiles(configs: EslintConfig[], files: string[], replace?: boolean): EslintConfig[] {
        return configs.map((config) => {
            const keys = Object.keys(config);
            if (keys.length === 1 && keys[0] === 'ignores') {
                // global ignores
                return config;
            }
            if (replace) {
                return {
                    ...config,
                    files,
                };
            }
            return {
                ...config,
                files: (config.files ?? []).concat(files.filter((file) => !config.files?.includes(file))),
            };
        });
    },
};

export default utils;
export type Utils = typeof utils;
