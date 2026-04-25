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

## Installation

Requires eslint 9.x

```
npm install @doubleaxe/eslint-plugin-module-path-fixer -D
pnpm add @doubleaxe/eslint-plugin-module-path-fixer -D
```

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

Normalizes imports between alias and relative forms after resolving the target and normalizing the specifier path.

The rule works in two directions:

- Relative specifiers may be rewritten to aliases when the resolved file has a matching alias.
- Alias specifiers may be rewritten to the shortest stable relative form when that form resolves to the same file.

Before any alias decision, the rule normalizes relative inputs with POSIX path normalization. For example:

```ts
// input
import mod from '../folder/../ff/qq';

// normalized before alias lookup
import mod from '../ff/qq';
```

### Options (all optional)

```ts
type PreferAliasOrRelativeRuleOptions = {
    folderAlias?: 'always' | 'never'; // default: 'always'
    parentFolderAliasDepth?: number; // default: 0
    alias?: Array<{
        baseUrl: string;
        paths: Record<string, string[]>;
    }>;
};
```

Defaults:

- `folderAlias` defaults to `'always'`
- `parentFolderAliasDepth` defaults to `0`
- `alias` defaults to global `settings['module-path-fixer'].alias`

Behavior:

- `folderAlias: 'always'`: walk backward through the current relative path and use the first alias that matches the resolved target.
- `folderAlias: 'never'`: skip the backward folder walk and only consider alias conversion when the parent-folder fallback is allowed.
- `parentFolderAliasDepth < 0`: disable the parent-folder fallback.
- `parentFolderAliasDepth = 0`: allow parent-folder aliasing only after at least one `..` segment.
- `parentFolderAliasDepth > 0`: require more `..` segments before parent-folder aliasing is considered.
- Local `./` imports stop after normalization if no folder alias is found.

### Usage Examples

Default behavior, `folderAlias: 'always'`:

```ts
// before
import { tool } from '../utils/tool';

// after
import { tool } from '@app/utils/tool';
```

Normalized relative path is handled before alias lookup:

```ts
// before
import { qq } from '../folder/../ff/qq';

// after
import { qq } from '@app/ff/qq';
```

Local relative imports are left alone when no folder alias matches:

```ts
// before
import { another } from './another';

// after
import { another } from './another';
```

`folderAlias: 'never'` with parent-folder alias fallback:

```ts
// before
import { qq } from '../ff/qq';

// after
import { qq } from '@root/rr/ff/qq';
```

`folderAlias: 'never'` with a threshold that blocks the fallback:

```ts
// before
import { qq } from '../ff/qq';

// after
import { qq } from '../ff/qq';
```

Alias to relative conversion:

```ts
// before
import { tool } from '@app/utils/tool';

// after
import { tool } from '../utils/tool';
```

Package imports alias to relative conversion:

```ts
// before
import mod from '#core';

// after
import mod from '../core';
```

Manual alias map override:

```ts
// before
import { tool } from '../shared/tool';

// after
import { tool } from '@manual/shared/tool';
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

// after
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
                    folderAlias: 'never',
                    parentFolderAliasDepth: 0,
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
