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
import { highlightShellCommand, formatTurnStatus } from '../../_shared/display.js';

export const STRUCTURAL_TOOL_ICONS: Record<string, string> = {
  // Precision filesystem / editor tools (filled glyphs)
  read: '■',
  grep: '■',
  find: '■',
  ls: '■',
  edit: '✏',
  write: '🖹',
  revert_file: '↩',
  revert: '↩',
  ast_search: '▲',
  'ast-search': '▲',

  // Shell execution (terminal icon \uf120 in NerdFont, followed by Shell)
  shell: '',
  sh: '',

  // Web tools
  web_search: '▲',
  web_fetch: '⇲',
  web_control: '⚙',
  web_source: '🖹',

  // Extra / Workspace tools
  outline: '☷',
  repo_map: '■',
  scratchpad: '🖹',
  session: '⚡',
  command_history: '◷',
  project_context: '⌸',
  model_router: '⌸',

  // Autonomous & Workflow tools
  goal: '⚡',
  schedule: '◷',
  recap: '🖹',

  // Context & Checkpoint tools
  ctx_record: '🖹',
  ctx_packet: '■',
  ctx_inject: '⚡',
  file_checkpoint: '■',

  // Grove expertise & issue tracking tools
  grove_read: '■',
  grove_write: '✏',
  grove_search: '▲',
  grove_promote: '△',

  // Document processing tools
  doc_read: '■',
  doc_ocr: '▲',
  doc_extract: '🖹',

  // Legacy/meta compat
  'basic-tools': '⚙',
  basic_tools: '⚙',
};

export function isStructuralTool(toolName: string): boolean {
  return Object.prototype.hasOwnProperty.call(STRUCTURAL_TOOL_ICONS, toolName);
}

export function getToolRoleIcon(toolName: string): string {
  return STRUCTURAL_TOOL_ICONS[toolName] ?? '•';
}

/**
 * Returns Codex/AGY status bullet with color:
 * - running / in-progress: cyan '\x1b[36m●\x1b[0m'
 * - success / finished: green '\x1b[32m●\x1b[0m'
 * - error: red '\x1b[31m●\x1b[0m'
 * - warning: amber '\x1b[33m●\x1b[0m'
 */
export function getStatusBullet(status: 'running' | 'success' | 'error' | 'warning' = 'success'): string {
  switch (status) {
    case 'running':
      return '\x1b[36m●\x1b[0m';
    case 'error':
      return '\x1b[31m●\x1b[0m';
    case 'warning':
      return '\x1b[33m●\x1b[0m';
    case 'success':
    default:
      return '\x1b[32m●\x1b[0m';
  }
}

export interface GroupedToolInfo {
  toolCallId: string;
  toolName: string;
  isGrouped: boolean;
  isFirst: boolean;
  isLast: boolean;
  prefix: string;
}

export class ToolGroupingTracker {
  private currentTurnTools: string[] = [];
  private consecutiveStructuralCount = 0;
  private firstToolIdInGroup: string | null = null;
  private toolCallMap = new Map<string, GroupedToolInfo>();
  private turnStartTime: number = Date.now();
  private agentStartTime: number = Date.now();

  reset(): void {
    this.currentTurnTools = [];
    this.consecutiveStructuralCount = 0;
    this.firstToolIdInGroup = null;
    this.toolCallMap.clear();
  }

  setAgentStart(time: number = Date.now()): void {
    this.agentStartTime = time;
    this.turnStartTime = time;
  }

  setTurnStart(time: number = Date.now()): void {
    this.turnStartTime = time;
  }

  getTurnDuration(now: number = Date.now()): number {
    return Math.max(0, now - this.agentStartTime);
  }

  recordToolStart(toolCallId: string, toolName: string): GroupedToolInfo {
    this.currentTurnTools.push(toolName);
    const structural = isStructuralTool(toolName);

    if (structural) {
      this.consecutiveStructuralCount++;
      if (this.consecutiveStructuralCount === 1) {
        this.firstToolIdInGroup = toolCallId;
      }
    } else {
      this.consecutiveStructuralCount = 0;
      this.firstToolIdInGroup = null;
    }

    const isGrouped = this.consecutiveStructuralCount > 1;
    const isFirst = this.consecutiveStructuralCount === 1;

    // When 2nd structural tool arrives, retroactively group the 1st tool
    if (isGrouped && this.firstToolIdInGroup) {
      const firstInfo = this.toolCallMap.get(this.firstToolIdInGroup);
      if (firstInfo && !firstInfo.isGrouped) {
        firstInfo.isGrouped = true;
        firstInfo.isFirst = true;
        const firstIcon = getToolRoleIcon(firstInfo.toolName);
        firstInfo.prefix = `┏ ${firstIcon} `;
      }
    }

    const icon = getToolRoleIcon(toolName);
    const prefix = isGrouped ? `┣ ${icon} ` : `${icon} `;

    const info: GroupedToolInfo = {
      toolCallId,
      toolName,
      isGrouped,
      isFirst,
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
      info.prefix = `┗ ${icon} `;
    }
    return info;
  }

  getInfo(toolCallId: string): GroupedToolInfo | undefined {
    return this.toolCallMap.get(toolCallId);
  }

  formatHeader(toolName: string, callText: string, isGrouped: boolean, isLast: boolean, isFirst = false): string {
    const icon = getToolRoleIcon(toolName);
    if (!isGrouped) {
      return `${icon} ${callText}`;
    }
    const glyph = isFirst ? '┏' : (isLast ? '┗' : '┣');
    return `${glyph} ${icon} ${callText}`;
  }
}

export const defaultTracker = new ToolGroupingTracker();

export const basicToolGroupingItemSchema = Type.Object({
  toolName: Type.String({ description: 'Tool name to check or format' }),
  callText: Type.Optional(Type.String({ description: 'Call text preview' })),
  isGrouped: Type.Optional(Type.Boolean({ description: 'Whether tool is part of a consecutive group' })),
  isLast: Type.Optional(Type.Boolean({ description: 'Whether tool is last in group' })),
  isFirst: Type.Optional(Type.Boolean({ description: 'Whether tool is first in group' })),
});

export const basicToolGroupingSchema = Type.Object({
  ops: Type.Optional(Type.Array(basicToolGroupingItemSchema, { description: 'Batch operations array' })),
  toolName: Type.Optional(Type.String({ description: 'Tool name to check or format' })),
  callText: Type.Optional(Type.String({ description: 'Call text preview' })),
  isGrouped: Type.Optional(Type.Boolean({ description: 'Whether tool is part of a consecutive group' })),
  isLast: Type.Optional(Type.Boolean({ description: 'Whether tool is last in group' })),
  isFirst: Type.Optional(Type.Boolean({ description: 'Whether tool is first in group' })),
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
  const isFirst = Boolean(params.isFirst);

  const formatted = defaultTracker.formatHeader(toolName, callText, isGrouped, isLast, isFirst);
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
      isFirst,
      isLast,
      formatted,
    },
  };
}

export function registerBasicToolGrouping(pi: ExtensionAPI, tracker: ToolGroupingTracker = defaultTracker): void {
  // Hook lifecycle events to maintain grouping state and turn timing
  pi.on('agent_start', () => {
    tracker.setAgentStart(Date.now());
  });

  pi.on('turn_start', () => {
    tracker.setTurnStart(Date.now());
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

  pi.on('agent_end', (event: any, ctx: any) => {
    const elapsed = tracker.getTurnDuration();
    // Only display "Worked for Xs • HH:MM" if work took non-trivial time (>500ms) or multiple turns/tools
    const statusLine = formatTurnStatus(elapsed, new Date());

    // 1. If AssistantMessageComponent was patched and there are assistant messages in event,
    // attach turnDurationBadge so it renders directly beneath the final assistant response
    try {
      const messages = event?.messages || [];
      const lastAssistantMsg = [...messages].reverse().find((m: any) => m.role === 'assistant');
      if (lastAssistantMsg) {
        lastAssistantMsg.turnDurationBadge = statusLine;
      }
    } catch {
      // non-fatal
    }

    // 2. Also notify status line via ctx.ui.setStatus if available for fallback visibility
    if (ctx?.ui?.setStatus) {
      try {
        ctx.ui.setStatus('turn-worked', statusLine.trim());
      } catch {
        // non-fatal
      }
    }
  });

  // Register tool definition overrides for structural tools to inject grouping styling and suppress spacers
  for (const toolName of Object.keys(STRUCTURAL_TOOL_ICONS)) {
    registerToolDefinitionOverride(toolName, {
      renderCall(args: any, theme: any, context: any) {
        const info = context?.toolCallId ? tracker.getInfo(context.toolCallId) : undefined;
        const isGrouped = info?.isGrouped ?? false;
        const isFirst = info?.isFirst ?? false;
        const isLast = info?.isLast ?? false;
        const icon = getToolRoleIcon(toolName);

        // When grouped (and not the first tool), suppress leading blank spacer line
        const shouldSuppressSpacer = isGrouped && !isFirst;

        if (context) {
          context.isGrouped = shouldSuppressSpacer;
          context.suppressLeadingSpacer = shouldSuppressSpacer;
          if (context.component) {
            context.component.isGrouped = shouldSuppressSpacer;
            context.component.suppressLeadingSpacer = shouldSuppressSpacer;
          }
        }

        // Heavy tree glyphs in bright white: '\x1b[1m\x1b[97m'
        const rawGlyph = isGrouped ? (isFirst ? '┏ ' : (isLast ? '┗ ' : '┣ ')) : '';
        const glyph = rawGlyph ? `\x1b[1m\x1b[97m${rawGlyph}\x1b[0m` : '';
        // Codex/AGY status bullet with execution state color
        const isError = Boolean(context?.isError);
        const isFinished = context?.isPartial === false || (context?.result !== undefined);
        const bulletStatus = !isFinished ? 'running' : (isError ? 'error' : 'success');
        const bullet = getStatusBullet(bulletStatus);
        let styled: string;

        if (toolName === 'sh' || toolName === 'shell') {
          const cmd = args?.command ?? (Array.isArray(args?.commands) ? args.commands[0] : '');
          const firstLineCmd = (cmd || '(empty)').split('\n')[0].trim();
          const highlightedCmd = highlightShellCommand(firstLineCmd);
          const chevronColor = isFinished ? (isError ? 'error' : 'success') : 'accent';
          // Format: ┏/┣/┗ ● Shell ❯ <cmd>
          styled = `${glyph}${bullet} \x1b[1m\x1b[97mShell\x1b[0m ${theme.fg(chevronColor, '❯')} ${highlightedCmd}`;
        } else if (toolName === 'read') {
          const files = args?.files ?? args?.ops ?? (args?.path ? [{ path: args.path, offset: args.offset, limit: args.limit }] : []);
          const first = files[0];
          const p = first?.path ?? '';
          const from = first?.offset ?? 1;
          const to = first?.limit ? `${from}-${Number(from) + Number(first.limit) - 1}` : `${from}..`;
          const range = files.length === 1 ? ` [${to}]` : ` [${files.length} files]`;
          styled = `${glyph}${bullet} ${theme.fg('toolTitle', 'Read')} (${theme.fg('accent', p)})${theme.fg('dim', range)}`;
        } else if (toolName === 'edit') {
          const edits = Array.isArray(args?.edits) ? args.edits : (Array.isArray(args?.ops) ? args.ops : []);
          const p = (typeof args?.path === 'string' ? args.path : (typeof args?.file_path === 'string' ? args.file_path : edits[0]?.path)) ?? '';
          const shortPath = p.replace(/^\/home\/[^\/]+\//, '~/');
          const count = edits.length > 1 ? ` [${edits.length} edits]` : '';
          styled = `${glyph}${bullet} ${theme.fg('toolTitle', 'Edit')} (${theme.fg('accent', shortPath || 'unknown')})${theme.fg('dim', count)}`;
        } else if (toolName === 'write') {
          const writes = args?.files ?? args?.ops ?? (args?.path ? [{ path: args.path }] : []);
          const first = writes[0];
          const p = first?.path ?? '';
          const count = writes.length > 1 ? ` [${writes.length} files]` : '';
          styled = `${glyph}${bullet} ${theme.fg('toolTitle', 'Write')} (${theme.fg('accent', p)})${theme.fg('dim', count)}`;
        } else if (toolName === 'web_search') {
          const q = args?.query ?? (Array.isArray(args?.ops) ? args.ops[0]?.query : '');
          const queryText = q ? ` ("${q.split('\n')[0].slice(0, 50)}")` : '';
          styled = `${glyph}${bullet} ${theme.fg('toolTitle', 'web_search')}${theme.fg('accent', queryText)}`;
        } else if (toolName === 'web_fetch') {
          const u = args?.url ?? (Array.isArray(args?.urls) ? args.urls[0] : (Array.isArray(args?.ops) ? args.ops[0]?.url : ''));
          const urlText = u ? ` (${u.split('\n')[0].slice(0, 60)})` : '';
          styled = `${glyph}${bullet} ${theme.fg('toolTitle', 'web_fetch')}${theme.fg('accent', urlText)}`;
        } else if (toolName === 'outline') {
          const p = args?.path ?? (Array.isArray(args?.ops) ? args.ops[0]?.path : '');
          const pathText = p ? ` (${p.split('/').pop() ?? p})` : '';
          styled = `${glyph}${bullet} ${theme.fg('toolTitle', 'outline')}${theme.fg('accent', pathText)}`;
        } else if (toolName === 'session') {
          const act = args?.action ?? (args?.command ? 'exec' : 'list');
          const id = args?.id ? ` [${args.id}]` : '';
          styled = `${glyph}${bullet} ${theme.fg('toolTitle', 'session')} ${theme.fg('accent', `${act}${id}`)}`;
        } else {
          let label = toolName;
          if ((toolName === 'basic-tools' || toolName === 'basic_tools') && Array.isArray(args?.ops) && args.ops.length > 0) {
            const firstOp = args.ops[0];
            const opType = firstOp?.type ?? (firstOp?.command ? 'sh' : (firstOp?.edits ? 'edit' : (firstOp?.content ? 'write' : 'op')));
            if (args.ops.length === 1) {
              const opTarget = firstOp?.command ? ` ${firstOp.command.split('\n')[0].slice(0, 40)}` : (firstOp?.path ? ` ${firstOp.path}` : '');
              label = `${toolName} (${opType}${opTarget})`;
            } else {
              label = `${toolName} (${args.ops.length} ops: ${opType}...)`;
            }
          }
          const titleText = `${label}`;
          styled = `${glyph}${bullet} ${theme.fg('toolTitle', titleText)}`;
        }

        return new Text(styled, 0, 0);
      },
    });
  }
}
