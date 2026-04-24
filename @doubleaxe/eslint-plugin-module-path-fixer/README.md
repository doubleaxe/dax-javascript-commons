# [@doubleaxe/eslint-plugin-module-path-fixer](https://github.com/doubleaxe/dax-javascript-commons/tree/main/%40doubleaxe/eslint-plugin-module-path-fixer)

ESLint plugin for deterministic module specifier normalization.

The plugin resolves real import targets and applies autofixes only when target resolution remains semantically equivalent. It is built for projects that combine:

- relative paths (`./`, `../`)
- `tsconfig.json` / `jsconfig.json` path aliases
- `package.json#imports`
- manual alias maps in tsconfig `paths` format

The plugin ships two autofixable rules:

- `prefer-alias-or-relative`
- `extensions`

All rule options are optional. Both rules apply internal defaults when options are omitted.

- Autofix: yes
- Scope:
    - `import ... from 'x'`
    - `export ... from 'x'`
    - `import('x')`
    - `require('x')`
    - `import x = require('x')`
- Ignores unresolved and non-static specifiers.

## Global Settings

Use `settings['module-path-fixer']`:

```ts
type ModulePathFixerSettings = {
    extensions?: string[];
    caseInsensitive?: boolean;
    usePackageJson?: boolean;
    useTsConfig?: boolean;
    alias?: Array<{
        baseUrl: string;
        paths: Record<string, string[]>;
    }>;
};
```

## Rule: `prefer-alias-or-relative`

Normalizes imports between alias and relative forms based on directory traversal depth.

### Options (all optional)

```ts
type PreferAliasOrRelativeRuleOptions = {
    depth?: number; // default: 1
    alias?: Array<{
        baseUrl: string;
        paths: Record<string, string[]>;
    }>;
};
```

Defaults:

- `depth` defaults to `1`
- `alias` defaults to global `settings['module-path-fixer'].alias`

`depth` behavior:

- `< 0`: always prefer relative
- `0`: always prefer alias when alias exists
- `1`: only same-directory relative imports are allowed
- `> 1`: allows more directory traversals before alias is required

### Usage Examples

Given `depth: 0` (prefer alias):

```ts
// before
import { tool } from '../utils/tool';

// after
import { tool } from '@app/utils/tool';
```

Given `depth: 1` (prefer near relatives):

```ts
// before
import { tool } from '@app/utils/tool';

// after
import { tool } from '../utils/tool';
```

With `package.json#imports` mapping:

```json
{
    "imports": {
        "#core": "./src/core/index.ts"
    }
}
```

```ts
// before
import mod from '../core';

// after (with depth: 0)
import mod from '#core';
```

## Rule: `extensions`

Enforces extension and index style for resolvable imports.

### Options (all optional)

```ts
type ExtensionsRuleOptions = {
    extension?: 'always' | 'never'; // default: 'never'
    index?: 'always' | 'never'; // default: 'never'
    alias?: Array<{
        baseUrl: string;
        paths: Record<string, string[]>;
    }>;
    extensionMapping?: Record<string, string>; // default: { ts: 'js', tsx: 'jsx', mts: 'mjs', cts: 'cjs' }
};
```

Defaults:

- `extension` defaults to `'never'`
- `index` defaults to `'never'`
- `extensionMapping` defaults to `{ ts: 'js', tsx: 'jsx', mts: 'mjs', cts: 'cjs' }`
- `alias` defaults to global `settings['module-path-fixer'].alias`

Behavior:

- `extension: 'always'`: enforces explicit extension in import specifier.
- `extension: 'never'`: removes explicit extension when safe.
- `index: 'always'`: enforces explicit `.../index` form for directory index targets.
- `index: 'never'`: enforces directory form without `/index` when safe.
- `extensionMapping` maps resolved source extension to emitted import extension.

### Usage Examples

`extension: 'always', index: 'never'`

```ts
// before
import { helper } from '../utils/helper';

// after
import { helper } from '../utils/helper.js';
```

`extension: 'never', index: 'never'`

```ts
// before
import mod from '../core/index.ts';

// after
import mod from '../core';
```

`extension: 'always', index: 'always'`

```ts
// before
import mod from '../core';

// after
import mod from '../core/index.js';
```

Alias input with explicit extension removal:

```ts
// before
import { tool } from '@app/utils/tool.ts';

// after (extension: 'never')
import { tool } from '@app/utils/tool';
```

## Flat Config Example

```js
import modulePathFixer from '@doubleaxe/eslint-plugin-module-path-fixer';

export default [
    {
        plugins: {
            'module-path-fixer': modulePathFixer,
        },
        settings: {
            'module-path-fixer': {
                // Global resolver settings
                extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'],
                caseInsensitive: false,
                useTsConfig: true,
                usePackageJson: true,
                alias: [
                    {
                        baseUrl: '.',
                        paths: {
                            '@app/*': ['src/*'],
                        },
                    },
                ],
            },
        },
        rules: {
            // Rule 1: all possible options
            'module-path-fixer/prefer-alias-or-relative': [
                'error',
                {
                    depth: 1,
                    alias: [
                        {
                            baseUrl: '.',
                            paths: {
                                '@feature/*': ['src/feature/*'],
                            },
                        },
                    ],
                },
            ],
            // Rule 2: all possible options
            'module-path-fixer/extensions': [
                'error',
                {
                    extension: 'always',
                    index: 'never',
                    alias: [
                        {
                            baseUrl: '.',
                            paths: {
                                '@shared/*': ['src/shared/*'],
                            },
                        },
                    ],
                    extensionMapping: {
                        ts: 'js',
                        tsx: 'jsx',
                        mts: 'mjs',
                        cts: 'cjs',
                    },
                },
            ],
        },
    },
];
```
