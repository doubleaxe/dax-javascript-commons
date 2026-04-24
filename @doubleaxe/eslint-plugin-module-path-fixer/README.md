# @doubleaxe/eslint-plugin-module-path-fixer

ESLint plugin for deterministic module specifier normalization.

The plugin resolves real import targets and applies autofixes only when target resolution remains semantically equivalent. It is built for projects that combine:

- relative paths (`./`, `../`)
- `tsconfig.json` / `jsconfig.json` path aliases
- `package.json#imports`
- manual alias maps in tsconfig `paths` format

## Rule: `extensions`

Enforces extension and index style for resolvable imports.

- Autofix: yes
- Scope:
    - `import ... from 'x'`
    - `export ... from 'x'`
    - `import('x')`
    - `require('x')`
    - `import x = require('x')`
- Ignores unresolved and non-static specifiers.

### Rule Options

```ts
type ExtensionsRuleOptions = {
    extension: 'always' | 'never';
    index: 'always' | 'never';
    alias?: Array<{
        baseUrl: string;
        paths: Record<string, string[]>;
    }>;
    extensionMapping?: Record<string, string>; // default: { ts: 'js', tsx: 'jsx', mts: 'mjs', cts: 'cjs' }
};
```

Behavior:

- `extension: 'always'`: enforces explicit extension in import specifier.
- `extension: 'never'`: removes explicit extension when safe.
- `index: 'always'`: enforces explicit `.../index` form for directory index targets.
- `index: 'never'`: enforces directory form without `/index` when safe.
- `alias` overrides global alias settings for this rule.
- `extensionMapping` maps resolved source extension to emitted import extension.

### Global Settings

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

### Flat Config Example

```js
import modulePathFixer from '@doubleaxe/eslint-plugin-module-path-fixer';

export default [
    {
        plugins: {
            'module-path-fixer': modulePathFixer,
        },
        settings: {
            'module-path-fixer': {
                extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'],
                useTsConfig: true,
                usePackageJson: true,
                alias: [{ baseUrl: '.', paths: { '@app/*': ['src/*'] } }],
            },
        },
        rules: {
            'module-path-fixer/extensions': [
                'error',
                {
                    extension: 'always',
                    index: 'never',
                    extensionMapping: { ts: 'js', tsx: 'jsx' },
                },
            ],
        },
    },
];
```

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
