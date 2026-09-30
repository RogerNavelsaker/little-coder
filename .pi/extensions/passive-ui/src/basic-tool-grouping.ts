/**
 * `basic-tool-grouping` — Groups consecutive structural-tool cards under ├/└ glyphs with role icons.
 *
 * Role icons:
 * - ◫ : read, grep, find, ls
 * - ✎ : edit, write
 * - ▸ : shell, sh
 * - ⌕ : ast_search, ast-search
 * - ↩ : revert_file, revert
 *
 * Utilizes `tool-execution-patch` for spacer suppression (isGrouped / suppressLeadingSpacer).
 */

import { Type } from '@sinclair/typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import { registerToolDefinitionOverride } from '../../_shared/tool-execution-patch.js';

export const STRUCTURAL_TOOL_ICONS: Record<string, string> = {
  read: '◫',
  grep: '◫',
  find: '◫',
  ls: '◫',
  edit: '✎',
  write: '✎',
  shell: '▸',
  sh: '▸',
  ast_search: '⌕',
  'ast-search': '⌕',
  revert_file: '↩',
  revert: '↩',
};

export function isStructuralTool(toolName: string): boolean {
  return Object.prototype.hasOwnProperty.call(STRUCTURAL_TOOL_ICONS, toolName);
}

export function getToolRoleIcon(toolName: string): string {
  return STRUCTURAL_TOOL_ICONS[toolName] ?? '•';
}

export interface GroupedToolInfo {
  toolCallId: string;
  toolName: string;
  isGrouped: boolean;
  isLast: boolean;
  prefix: string;
}

export class ToolGroupingTracker {
  private currentTurnTools: string[] = [];
  private consecutiveStructuralCount = 0;
  private toolCallMap = new Map<string, GroupedToolInfo>();

  reset(): void {
    this.currentTurnTools = [];
    this.consecutiveStructuralCount = 0;
    this.toolCallMap.clear();
  }

  recordToolStart(toolCallId: string, toolName: string): GroupedToolInfo {
    this.currentTurnTools.push(toolName);
    const structural = isStructuralTool(toolName);

    if (structural) {
      this.consecutiveStructuralCount++;
    } else {
      this.consecutiveStructuralCount = 0;
    }

    const isGrouped = this.consecutiveStructuralCount > 1;
    const icon = getToolRoleIcon(toolName);
    const prefix = isGrouped ? `├ ${icon} ` : `${icon} `;

    const info: GroupedToolInfo = {
      toolCallId,
      toolName,
      isGrouped,
      isLast: false,
      prefix,
    };

    this.toolCallMap.set(toolCallId, info);
    return info;
  }

  recordToolEnd(toolCallId: string, isLastInTurn = false): GroupedToolInfo | undefined {
    const info = this.toolCallMap.get(toolCallId);
    if (!info) return undefined;

    if (info.isGrouped && isLastInTurn) {
      info.isLast = true;
      const icon = getToolRoleIcon(info.toolName);
      info.prefix = `└ ${icon} `;
    }
    return info;
  }

  getInfo(toolCallId: string): GroupedToolInfo | undefined {
    return this.toolCallMap.get(toolCallId);
  }

  formatHeader(toolName: string, callText: string, isGrouped: boolean, isLast: boolean): string {
    const icon = getToolRoleIcon(toolName);
    if (!isGrouped) {
      return `${icon} ${callText}`;
    }
    const glyph = isLast ? '└' : '├';
    return `${glyph} ${icon} ${callText}`;
  }
}

export const defaultTracker = new ToolGroupingTracker();

export const basicToolGroupingItemSchema = Type.Object({
  toolName: Type.String({ description: 'Tool name to check or format' }),
  callText: Type.Optional(Type.String({ description: 'Call text preview' })),
  isGrouped: Type.Optional(Type.Boolean({ description: 'Whether tool is part of a consecutive group' })),
  isLast: Type.Optional(Type.Boolean({ description: 'Whether tool is last in group' })),
});

export const basicToolGroupingSchema = Type.Object({
  ops: Type.Optional(Type.Array(basicToolGroupingItemSchema, { description: 'Batch operations array' })),
  toolName: Type.Optional(Type.String({ description: 'Tool name to check or format' })),
  callText: Type.Optional(Type.String({ description: 'Call text preview' })),
  isGrouped: Type.Optional(Type.Boolean({ description: 'Whether tool is part of a consecutive group' })),
  isLast: Type.Optional(Type.Boolean({ description: 'Whether tool is last in group' })),
});

export async function executeBasicToolGroupingOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  _ctx?: any
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeBasicToolGroupingOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, _ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeBasicToolGroupingOp(_toolCallId, op, _signal, _onUpdate, _ctx))
    );
    return {
      content: [{ type: 'text' as const, text: results.map(r => r.content[0].text).join('\n') }],
      isError: false,
      details: {
        totalOps: results.length,
        results: results.map(r => r.details),
      },
    };
  }

  const toolName = params.toolName ?? 'read';
  const callText = params.callText ?? toolName;
  const isGrouped = Boolean(params.isGrouped);
  const isLast = Boolean(params.isLast);

  const formatted = defaultTracker.formatHeader(toolName, callText, isGrouped, isLast);
  const icon = getToolRoleIcon(toolName);
  const isStructural = isStructuralTool(toolName);

  return {
    content: [{ type: 'text' as const, text: formatted }],
    isError: false,
    details: {
      toolName,
      icon,
      isStructural,
      isGrouped,
      isLast,
      formatted,
    },
  };
}

export function registerBasicToolGrouping(pi: ExtensionAPI, tracker: ToolGroupingTracker = defaultTracker): void {
  // Hook lifecycle events to maintain grouping state
  pi.on('turn_start', () => {
    tracker.reset();
  });

  pi.on('tool_execution_start', (event: any) => {
    if (event?.toolCallId && event?.toolName) {
      tracker.recordToolStart(event.toolCallId, event.toolName);
    }
  });

  pi.on('tool_execution_end', (event: any) => {
    if (event?.toolCallId) {
      tracker.recordToolEnd(event.toolCallId);
    }
  });

  pi.on('turn_end', () => {
    tracker.reset();
  });

  // Register tool definition overrides for structural tools to inject grouping styling and suppress spacers
  for (const toolName of Object.keys(STRUCTURAL_TOOL_ICONS)) {
    registerToolDefinitionOverride(toolName, {
      renderCall(args: any, theme: any, context: any) {
        const info = context?.toolCallId ? tracker.getInfo(context.toolCallId) : undefined;
        const isGrouped = info?.isGrouped ?? false;
        const isLast = info?.isLast ?? false;
        const icon = getToolRoleIcon(toolName);

        // When grouped, set isGrouped on component to suppress leading blank spacer line via tool-execution-patch
        if (context) {
          context.isGrouped = isGrouped;
          context.suppressLeadingSpacer = isGrouped;
        }

        const glyph = isGrouped ? (isLast ? '└ ' : '├ ') : '';
        const titleText = `${glyph}${icon} ${toolName}`;
        const styled = theme.fg('toolTitle', titleText);
        return new Text(styled, 0, 0);
      },
    });
  }
}
