# @doubleaxe/eslint-plugin-module-path-fixer

ESLint plugin for deterministic module specifier normalization.

The library resolves real import targets and safely rewrites only when resolution stays semantically equivalent. It is designed for mixed setups with:

- relative paths (`./`, `../`)
- `tsconfig.json` / `jsconfig.json` path aliases
- `package.json#imports`
- user-defined alias maps (tsconfig `paths` format)

Current rule implemented:

- `prefer-alias-or-relative`

## Rule: `prefer-alias-or-relative`

Normalizes imports between alias and relative forms based on directory traversal depth.

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
type PreferAliasOrRelativeOptions = {
    depth?: number; // default: 1
    alias?: Array<{
        baseUrl: string;
        paths: Record<string, string[]>;
    }>; // overrides global alias
};
```

`depth` behavior:

- `< 0`: always prefer relative
- `0`: always prefer alias when alias exists
- `1`: only same-directory relative imports are allowed
- `> 1`: allows more directory traversals before alias is required

### Global Settings

Use `settings["module-path-fixer"]`:

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
                extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
                useTsConfig: true,
                usePackageJson: true,
                alias: [{ baseUrl: '.', paths: { '@app/*': ['src/*'] } }],
            },
        },
        rules: {
            'module-path-fixer/prefer-alias-or-relative': ['error', { depth: 1 }],
        },
    },
];
```

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
