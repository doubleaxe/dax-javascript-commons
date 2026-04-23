## Project Goal

Build an ESLint plugin for import path management with two autofixable rules.

## High-Level Requirements

- Plugin exposes exactly 2 rules.
- Both rules support autofix.
- Rules must work only with real module imports and should not rewrite unknown/unresolvable specifiers.
- Resolution behavior must support:
    - Relative paths (`./`, `../`).
    - `tsconfig.json` / `jsconfig.json` path aliases via `tsconfig-paths` npm package.
    - `package.json` `imports` mappings via Node.js import resolution behavior.
- Any path that does not match supported resolution mechanisms must be ignored.

## Imports Scope

Rules should process import-like syntax that represents real imports in code:

- `import ... from 'x'`
- `export ... from 'x'`
- `import('x')`

(If a specifier is not a static string literal, ignore it.)

## Rule 1: Relative vs Alias by Depth

Suggested name: `prefer-alias-or-relative-by-depth`

### Purpose

Normalize between relative and alias imports based on directory traversal depth.

### Options

- `depth` (required, integer >= 0)
    - Number of allowed parent traversals (`../`) before alias form is required.

### Behavior

1. For relative imports:

- Count parent traversals in the specifier.
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

Suggested name: `enforce-import-extension`

### Purpose

Resolve import target and add/remove file extension according to configuration.

### Options

- `mode` (required):
    - `"always"` - import specifier must include extension.
    - `"never"` - import specifier must omit extension.
- Optional allow/deny list for extensions may be added later; default behavior applies to resolvable local/alias/imports-mapped files.

### Behavior

1. Resolve import target to a file using supported resolvers.
2. If mode is `always`:

- Ensure specifier ends with resolved file extension (e.g. `.js`, `.ts`, `.tsx`, `.mjs`, etc. depending on source and project policy).

3. If mode is `never`:

- Remove explicit extension from specifier where valid resolution remains the same.

4. If target is unresolved or external/unsupported, do nothing.

### Notes

- Must avoid unsafe rewrites that would change module resolution result.
- Respect Node ESM/CJS constraints where extension presence can affect runtime behavior.

## Resolution Strategy

Use a layered resolver:

1. Relative path resolution from importing file.
2. TS/JS config paths resolution via `tsconfig-paths`.
3. `package.json#imports` resolution using Node mechanism.
4. If none resolve, mark as unsupported and ignore.

## Autofix Requirements

- Fixes must be deterministic and idempotent.
- Running ESLint `--fix` repeatedly should produce no further changes after first valid fix.
- Never apply a fix when resolution confidence is insufficient.

## Non-Goals

- Rewriting arbitrary bare package dependencies from `node_modules`.
- Handling non-literal dynamic import specifiers.
- Implementing custom resolver ecosystems outside relative, `tsconfig/jsconfig` paths, and `package.json#imports`.

## Acceptance Criteria

- Both rules are present and documented.
- Both rules provide autofix.
- Rules operate only on resolvable real imports.
- Relative/alias conversion follows `depth` threshold logic.
- Extension rule correctly adds/removes extension per mode.
- Unsupported paths are ignored without errors.
