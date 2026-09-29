/**
 * Universal Op[] schema for basic-tools.
 *
 * All basic-tools use a discriminated union schema with an `ops` array.
 * Each op has a `type` discriminator and tool-specific params.
 *
 * Example:
 *   { ops: [{ type: "read", files: [{ path: "src/foo.ts" }] }] }
 *   { ops: [{ type: "grep", pattern: "hello", limit: 10 }] }
 *   { ops: [{ type: "edit", edits: [{ path: "src/foo.ts", old_text: "...", new_text: "..." }] }] }
 */
import { Type, type Static } from '@sinclair/typebox';

// --- Base types ---

export const OpKind = Type.Union([
  Type.Literal('read'),
  Type.Literal('grep'),
  Type.Literal('edit'),
  Type.Literal('write'),
  Type.Literal('find'),
  Type.Literal('ls'),
  Type.Literal('shell'),
  Type.Literal('ast_search'),
], { description: 'Op type discriminator' });

// --- Read op ---

export const ReadFileSpec = Type.Object({
  path: Type.String({ description: 'File path to read (relative or absolute)' }),
  offset: Type.Optional(Type.Union([
    Type.Number({ description: 'Start line (1-indexed)' }),
    Type.String({ description: 'Start line (1-indexed)' }),
  ])),
  limit: Type.Optional(Type.Union([
    Type.Number({ description: 'Max lines to read' }),
    Type.String({ description: 'Max lines to read' }),
  ])),
  after_anchor: Type.Optional(Type.String({ description: 'Anchor hash to start after (exclusive)' })),
});

export const ReadOp = Type.Object({
  type: Type.Literal('read'),
  files: Type.Array(ReadFileSpec, { description: 'Files to read' }),
  display: Type.Optional(Type.Union([
    Type.Literal('auto'),
    Type.Literal('compact'),
    Type.Literal('table'),
    Type.Literal('full'),
  ])),
});

// --- Grep op ---

export const GrepOp = Type.Object({
  type: Type.Literal('grep'),
  pattern: Type.String({ description: 'Search pattern (regex or literal)' }),
  path: Type.Optional(Type.String({ description: 'File or directory to search' })),
  literal: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  ignore_case: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  limit: Type.Optional(Type.Union([
    Type.Number(),
    Type.String(),
  ])),
  context: Type.Optional(Type.Union([
    Type.Number(),
    Type.String(),
  ])),
  glob: Type.Optional(Type.String({ description: 'Glob pattern to scope search' })),
  summary: Type.Optional(Type.Boolean({ description: 'Return count-matches per file (rg --count-matches)' })),
  scope: Type.Optional(Type.Union([
    Type.Literal('ast_search'),
    Type.Literal('regex'),
  ], { description: 'Search scope: ast_search uses ast-grep, regex uses ripgrep' })),
  display: Type.Optional(Type.Union([
    Type.Literal('auto'),
    Type.Literal('compact'),
    Type.Literal('table'),
    Type.Literal('full'),
  ])),
});

// --- Edit op ---

export const EditItem = Type.Object({
  path: Type.String({ description: 'File path to edit' }),
  old_text: Type.String({ description: 'Exact text to find' }),
  new_text: Type.String({ description: 'Replacement text' }),
  mode: Type.Optional(Type.Union([
    Type.Literal('replace'),
    Type.Literal('replace_by_anchor'),
    Type.Literal('replace_symbol'),
    Type.Literal('patch'),
  ])),
  anchor: Type.Optional(Type.String({ description: 'Linehash anchor (for replace_by_anchor)' })),
  occurrence: Type.Optional(Type.Union([
    Type.Literal('first'),
    Type.Literal('all'),
  ])),
  all_occurrences: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  fuzzy: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  symbol: Type.Optional(Type.String({ description: 'Symbol name (for replace_symbol mode)' })),
  diff: Type.Optional(Type.String({ description: 'Unified diff (for patch mode)' })),
});

export const EditOp = Type.Object({
  type: Type.Literal('edit'),
  edits: Type.Array(EditItem, { description: 'Edits to apply' }),
  dry_run: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  display: Type.Optional(Type.Union([
    Type.Literal('compact'),
    Type.Literal('table'),
    Type.Literal('full'),
  ])),
});

// --- Write op ---

export const WriteFileSpec = Type.Object({
  path: Type.String({ description: 'File path to write' }),
  content: Type.String({ description: 'Content to write' }),
  if_exists: Type.Optional(Type.Union([
    Type.Literal('overwrite'),
    Type.Literal('error'),
    Type.Literal('append'),
  ])),
  create_dirs: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
});

export const WriteOp = Type.Object({
  type: Type.Literal('write'),
  files: Type.Array(WriteFileSpec, { description: 'Files to write' }),
  display: Type.Optional(Type.Union([
    Type.Literal('compact'),
    Type.Literal('table'),
    Type.Literal('full'),
  ])),
});

// --- Find op ---

export const FindOp = Type.Object({
  type: Type.Literal('find'),
  op: Type.Optional(Type.Union([
    Type.Literal('glob'),
    Type.Literal('recent'),
    Type.Literal('sized'),
  ])),
  pattern: Type.Optional(Type.String({ description: 'Glob pattern (glob op)' })),
  path: Type.Optional(Type.String({ description: 'Root directory to search' })),
  file_type: Type.Optional(Type.Union([
    Type.Literal('f'),
    Type.Literal('d'),
    Type.Literal('l'),
    Type.Literal('s'),
    Type.Literal('x'),
  ])),
  hidden: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  follow_symlinks: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  exclude: Type.Optional(Type.Union([
    Type.String(),
  ])),
  max_depth: Type.Optional(Type.Union([
    Type.Number(),
    Type.String(),
  ])),
  limit: Type.Optional(Type.Union([
    Type.Number(),
    Type.String(),
  ])),
  sortBy: Type.Optional(Type.Union([
    Type.Literal('name'),
    Type.Literal('mtime'),
    Type.Literal('size'),
  ])),
  modifiedSince: Type.Optional(Type.String({ description: 'Duration string (recent op)' })),
  minSize: Type.Optional(Type.String({ description: 'Min file size (sized op)' })),
  maxSize: Type.Optional(Type.String({ description: 'Max file size (sized op)' })),
  display: Type.Optional(Type.Union([
    Type.Literal('compact'),
    Type.Literal('table'),
    Type.Literal('full'),
  ])),
});

// --- Ls op ---

export const LsOp = Type.Object({
  type: Type.Literal('ls'),
  path: Type.Optional(Type.String({ description: 'Directory to list' })),
  all: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  long: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  dirs_first: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  limit: Type.Optional(Type.Union([
    Type.Number(),
    Type.String(),
  ])),
  tree: Type.Optional(Type.Union([
    Type.Boolean(),
    Type.String(),
  ])),
  depth: Type.Optional(Type.Union([
    Type.Number(),
    Type.String(),
  ])),
  display: Type.Optional(Type.Union([
    Type.Literal('compact'),
    Type.Literal('table'),
    Type.Literal('full'),
  ])),
});

// --- Shell op ---

export const ShellOp = Type.Object({
  type: Type.Literal('shell'),
  command: Type.String({ description: 'Command to execute' }),
  env_mode: Type.Optional(Type.Union([
    Type.Literal('auto'),
    Type.Literal('current'),
    Type.Literal('none'),
    Type.Literal('direnv'),
    Type.Literal('clean'),
  ])),
  timeout: Type.Optional(Type.Union([
    Type.Number(),
    Type.String(),
  ])),
  display: Type.Optional(Type.Union([
    Type.Literal('compact'),
    Type.Literal('table'),
    Type.Literal('full'),
  ])),
});

// --- AstSearch op ---

export const AstSearchOp = Type.Object({
  type: Type.Literal('ast_search'),
  pattern: Type.String({ description: 'AST pattern' }),
  path: Type.Optional(Type.String({ description: 'File or directory to search' })),
  language: Type.Optional(Type.String({ description: 'Language filter' })),
  glob: Type.Optional(Type.String({ description: 'Glob pattern to scope search' })),
  limit: Type.Optional(Type.Union([
    Type.Number(),
    Type.String(),
  ])),
  display: Type.Optional(Type.Union([
    Type.Literal('auto'),
    Type.Literal('compact'),
    Type.Literal('table'),
    Type.Literal('full'),
  ])),
});

// --- Union of all ops ---

export type Op =
  | Static<typeof ReadOp>
  | Static<typeof GrepOp>
  | Static<typeof EditOp>
  | Static<typeof WriteOp>
  | Static<typeof FindOp>
  | Static<typeof LsOp>
  | Static<typeof ShellOp>
  | Static<typeof AstSearchOp>;

export const UnifiedToolSchema = Type.Object({
  ops: Type.Array(Type.Union([
    ReadOp,
    GrepOp,
    EditOp,
    WriteOp,
    FindOp,
    LsOp,
    ShellOp,
    AstSearchOp,
  ]), { description: 'Array of operations to execute' }),
});

export type UnifiedToolParams = Static<typeof UnifiedToolSchema>;
