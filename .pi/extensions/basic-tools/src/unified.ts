/**
 * Unified tool dispatcher for the Op[] schema.
 *
 * Routes each op.type to the appropriate handler function.
 * Maintains backward compatibility with individual tool registration.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { Type } from '@sinclair/typebox';
import {
  UnifiedToolSchema,
  type Op,
  type UnifiedToolParams,
} from './schema.js';
import { executeReadOp } from './read.js';
import { executeGrepOp } from './grep.js';
import { executeEditOp } from './edit.js';
import { executeWriteOp } from './write.js';
import { executeFindOp } from './find.js';
import { executeLsOp } from './ls.js';
import { executeShellOp } from './shell.js';
import { executeAstSearchOp } from './ast-search.js';
import { error } from './output.js';

/**
 * Dispatch a single op to its handler.
 */
async function dispatchOp(
  op: Op,
  toolCallId: string,
  signal: AbortSignal | undefined,
  onUpdate: ((update: unknown) => void) | undefined,
  ctx: { cwd: string },
): Promise<unknown> {
  switch (op.type) {
    case 'read':
      return executeReadOp(toolCallId, op as Extract<Op, { type: 'read' }>, signal, onUpdate, ctx);
    case 'grep':
      return executeGrepOp(toolCallId, op as Extract<Op, { type: 'grep' }>, signal, onUpdate, ctx);
    case 'edit':
      return executeEditOp(toolCallId, op as Extract<Op, { type: 'edit' }>, signal, onUpdate, ctx);
    case 'write':
      return executeWriteOp(toolCallId, op as Extract<Op, { type: 'write' }>, signal, onUpdate, ctx);
    case 'find':
      return executeFindOp(toolCallId, op as Extract<Op, { type: 'find' }>, signal, onUpdate, ctx);
    case 'ls':
      return executeLsOp(toolCallId, op as Extract<Op, { type: 'ls' }>, signal, onUpdate, ctx);
    case 'sh':
    case 'shell':
      return executeShellOp(toolCallId, op as any, signal, onUpdate, ctx);
    case 'ast_search':
      return executeAstSearchOp(toolCallId, op as Extract<Op, { type: 'ast_search' }>, signal, onUpdate, ctx);
    default:
      return {
        content: [{ type: 'text', text: error('invalid-params', `Unknown op type: ${(op as any).type}`, { tool: 'unified' }).message }],
        isError: true,
        details: { errorType: 'invalid-op', opType: (op as any).type },
      };
  }
}

/**
 * Register the unified basic-tools tool with the Op[] schema.
 */
export function registerUnifiedTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'basic-tools',
    label: 'Basic Tools',
    description:
      'Universal tool for file operations: read, grep, edit, write, find, ls, shell, ast_search. '
      + 'Pass an ops array with one or more operations. Each op has a type discriminator and tool-specific params.',
    promptSnippet: 'Use basic-tools for file operations',
    promptGuidelines: [
      'Pass ops: [{type, ...params}].',
      'Supported types: read, grep, edit, write, find, ls, shell, ast_search.',
      'Multiple ops can be batched in a single call.',
      'Example: ops: [{type: "read", files: [{path: "src/foo.ts"}]}, {type: "grep", pattern: "hello"}]',
    ],
    parameters: UnifiedToolSchema,
    async execute(toolCallId, params: any, signal, onUpdate, ctx) {
      if (!params.ops || params.ops.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: error('invalid-params', 'ops[] is required (e.g. ops: [{type: "read", files: [{path: "src/foo.ts"}]}])', { tool: 'basic-tools' }).message,
          }],
          isError: true,
          details: { errorType: 'invalid-params' },
        };
      }

      // Dispatch each op and collect results
      const results = await Promise.all(
        params.ops.map((op: any) => dispatchOp(op, toolCallId, signal, onUpdate as any, ctx)),
      );

      // Combine results into a single response
      const allContent: Array<{ type: string; text: string }> = [];
      const allDetails: Record<string, unknown> = {};
      let hasError = false;

      for (const result of results) {
        const r = result as any;
        if (r?.isError) {
          hasError = true;
          if (r.content?.[0]?.text) {
            allContent.push(r.content[0]);
          }
        } else {
          if (r?.content?.[0]?.text) {
            allContent.push(r.content[0]);
          }
          if (r?.details) {
            Object.assign(allDetails, r.details);
          }
        }
      }

      return {
        content: allContent,
        details: allDetails,
        isError: hasError,
      } as any;
    },
    renderResult(result, { expanded, isPartial }, theme, _context) {
      if (isPartial) {
        return new Text(theme.fg('warning', 'Running...')) as any;
      }

      const details = (result as any)?.details ?? {};
      const content = (result as any)?.content ?? [];

      if (content.length > 0) {
        const text = content.map((c: any) => c.text).join('\n');
        return new Text(text) as any;
      }

      const summaryParts: string[] = [];
      if (details.totalFiles) summaryParts.push(`${details.totalFiles} file(s)`);
      if (details.totalMatches) summaryParts.push(`${details.totalMatches} match(es)`);
      if (details.linesChanged) summaryParts.push(`${details.linesChanged} line(s) changed`);

      if (summaryParts.length > 0) {
        return new Text(summaryParts.join(', ')) as any;
      }

      return new Text('OK') as any;
    },
  });
}
