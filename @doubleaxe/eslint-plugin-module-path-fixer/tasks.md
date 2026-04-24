## Project Goal

Build an ESLint plugin for module path management with two autofixable rules.

## High-Level Requirements

- Plugin exposes exactly 2 rules.
- Both rules support autofix.
- Rules must work only with real imports and should not rewrite unknown/unresolvable specifiers.
- Resolution behavior must support:
    - Relative paths (`./`, `../`).
    - `tsconfig.json` / `jsconfig.json` path aliases via `tsconfig-paths` npm package.
    - `package.json` `imports` mappings via Node.js import resolution behavior.
    - User provided set of aliases, same format as `tsconfig.json`
    - Must handle directory with index files
- Any path that does not match supported resolution mechanisms must be ignored.

## Imports Scope

Rules should process import-like syntax that represents real imports in code:

- `import ... from 'x'`
- `export ... from 'x'`
- `import('x')`
- `const x = require('x')`
- `import x = require('x')`

(If a specifier is not a static string literal, ignore it.)

## Global settings

Global settings are set with eslint `settings` under `module-path-fixer` key.

- `extensions` supported extension for file resolution
- `caseInsensitive` override auto detection of case insensitive file system
- `usePackageJson`
- `useTsConfig`
- `alias` list of manual aliases in format `[{baseUrl: "baseUrl1", paths: {alias1: ["path1"]}}, {baseUrl: "baseUrl2"}]`

## Rule 1: Relative vs Alias by Depth

Suggested name: `prefer-alias-or-relative`

### Purpose

Normalize between relative and alias imports based on directory traversal depth.

### Options

- `depth` (optional, integer, default = 1)
    - Number of allowed path traversals before alias form is required.
    - If depth < 0 relative paths are always used
    - If depth = 0 aliases are always used
    - If depth = 1 relative paths are used only for current directory imports
- `alias` overrides global alias settings

### Behavior

1. For relative imports:

- Count path traversals in the specifier including leading dot.
- If traversal count is **greater than `depth`**:
    - Replace relative import with an alias import if an alias is available for the resolved target.
    - If no alias mapping can represent the same target, leave unchanged.

2. For alias imports:

- If target can be represented as a relative path from current file with traversal count **less than or equal to `depth`**:
    - Replace alias import with relative import.
- Otherwise leave as alias.

### Notes

- Conversion must preserve semantic target (same resolved file/module).
- Prefer shortest stable relative path when converting alias -> relative.
- Do not modify bare package imports (e.g. `react`) unless they are mapped by supported mechanisms and conversion is semantically valid.

## Rule 2: Enforce Extension Presence/Absence

Suggested name: `extensions`

### Purpose

Resolve import target and add/remove file extension according to configuration. Also handles directory with index.

### Options

- `extension` (required):
    - `"always"` - import specifier must include extension.
    - `"never"` - import specifier must omit extension.
- `index` (required):
    - `"always"` - always must be fill name `directory/index` with extension according to setting.
    - `"never"` - always must be just `directory`.
- `alias` overrides global alias settings
- `extensionMapping` object with mapping of real extensions to import extensions, default `{ 'ts': 'js', 'tsx': 'jsx', 'mts': 'mjs', 'cts': 'cjs' }`

### Behavior

1. Resolve import target to a file using supported resolvers.

2. If it is directory index process it according to settings.

3. If extension is `always`:

- Ensure specifier ends with resolved file extension (e.g. `.js`, `.ts`, `.tsx`, `.mjs`, etc. depending on source and project policy).

4. If extension is `never`:

- Remove explicit extension from specifier where valid resolution remains the same.

5. If target is unresolved or external/unsupported, do nothing.

### Notes

- Must avoid unsafe rewrites that would change module resolution result.
- Respect Node ESM/CJS constraints where extension presence can affect runtime behavior.

## Autofix Requirements

- Fixes must be deterministic and idempotent.
- Running ESLint `--fix` repeatedly should produce no further changes after first valid fix.
- Never apply a fix when resolution confidence is insufficient.

## Acceptance Criteria

- Both rules are present and documented.
- Both rules provide autofix.
- Rules operate only on resolvable real imports.
- Relative/alias conversion follows `depth` threshold logic.
- Extension rule correctly adds/removes extension per mode.
- Unsupported paths are ignored without errors.
