/**
 * `passive-ui` extension — Unified entry for basic-tool-grouping and thinking-steps.
 *
 * Integrates:
 * - basic-tool-grouping: groups consecutive structural-tool cards under ├/└ glyphs with role icons.
 * - thinking-steps: patches AssistantMessageComponent.prototype reference-counted via Symbol.
 * - tool-execution-patch: spacer suppression for grouped tools and thinking blocks.
 */

import { Type } from '@sinclair/typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';
import {
  registerBasicToolGrouping,
  defaultTracker,
  ToolGroupingTracker,
} from './basic-tool-grouping.js';
import {
  patchAssistantMessageComponent,
  unpatchAssistantMessageComponent,
  getThinkingStepsPatchRefCount,
} from './thinking-steps.js';
import {
  toggleDetailedStatusline,
  isDetailedStatusline,
  getStatuslineMode,
  setStatuslineMode,
  type StatuslineMode,
} from '../../_shared/tool-execution-patch.js';
import { saveStatuslineSetting } from '../../_shared/little-coder-config.js';

export const passiveUiItemSchema = Type.Object({
  action: Type.Optional(Type.Union([
    Type.Literal('status'),
    Type.Literal('enable'),
    Type.Literal('disable'),
  ])),
});

export const passiveUiSchema = Type.Object({
  ops: Type.Optional(Type.Array(passiveUiItemSchema, { description: 'Batch operations array' })),
  action: Type.Optional(
    Type.Union([
      Type.Literal('status', { description: 'Get passive UI status (default)' }),
      Type.Literal('enable', { description: 'Enable passive UI features' }),
      Type.Literal('disable', { description: 'Disable passive UI features' }),
    ], { description: 'Action to perform' })
  ),
});

export async function executePassiveUiOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  _ctx?: any
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executePassiveUiOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, _ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executePassiveUiOp(_toolCallId, op, _signal, _onUpdate, _ctx))
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

  const action = params.action ?? 'status';

  if (action === 'enable') {
    patchAssistantMessageComponent();
  } else if (action === 'disable') {
    unpatchAssistantMessageComponent();
  }

  const refCount = getThinkingStepsPatchRefCount();
  const statusMsg = `Passive UI active: tool-grouping=enabled, thinking-steps=${refCount > 0 ? 'enabled' : 'disabled'} (refCount=${refCount})`;

  return {
    content: [{ type: 'text' as const, text: statusMsg }],
    isError: false,
    details: {
      toolGrouping: 'enabled',
      thinkingSteps: refCount > 0 ? 'enabled' : 'disabled',
      thinkingStepsRefCount: refCount,
    },
  };
}

export function registerPassiveUi(pi: ExtensionAPI, tracker: ToolGroupingTracker = defaultTracker): void {
  // Register basic-tool-grouping hooks & overrides
  registerBasicToolGrouping(pi, tracker);

  // Apply thinking-steps prototype patch
  patchAssistantMessageComponent();

  // Register passive_ui status tool
  pi.registerTool({
    name: 'passive_ui',
    label: 'Passive UI',
    description: 'Inspect or configure passive UI features (tool grouping and thinking steps).',
    promptSnippet: 'Passive UI inspector and configuration',
    promptGuidelines: ['Use passive_ui to check or toggle UI enhancements.'],
    parameters: passiveUiSchema,

    renderCall(args: any, theme: any) {
      const action = args?.action ?? 'status';
      const text = theme.fg('toolTitle', 'passive_ui ') + theme.fg('accent', action);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const details = result?.details;
      const text = theme.fg('muted', `Passive UI (grouping: ${details?.toolGrouping}, thinking: ${details?.thinkingSteps})`);
      return new Text(text, 0, 0);
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      return (executePassiveUiOp(toolCallId, params, signal, onUpdate, ctx) as any);
    },
  });

  // Register /statusline command: configure statusline preset or inspect modes
  if (typeof pi.registerCommand === 'function') {
    pi.registerCommand('statusline', {
      description: 'Configure statusline preset: /statusline [minimal|standard|full|off|status]',
      handler: async (args: string, ctx: any) => {
        const target = (args || '').trim().toLowerCase();
        if (target === 'minimal' || target === 'standard' || target === 'full' || target === 'off') {
          setStatuslineMode(target as StatuslineMode);
          saveStatuslineSetting(target as StatuslineMode, ctx?.cwd || process.cwd());
          if (ctx?.ui?.notify) {
            ctx.ui.notify(`Statusline mode set and saved to: ${target}`, 'info');
          }
          return;
        }

        const current = getStatuslineMode();
        const msg = [
          `Current statusline mode: ${current}`,
          `Options:`,
          `  /statusline minimal   - Clean: repo · model · context% (default)`,
          `  /statusline standard  - repo · model · context% · token metrics`,
          `  /statusline full      - repo · model · context% · token metrics · cost`,
          `  /statusline off       - Disable statusline entirely`,
        ].join('\n');

        if (ctx?.ui?.notify) {
          ctx.ui.notify(msg, 'info');
        }
      },
    });

    // Register /quickinfo command: opens an interactive modal or notification with full metrics
    pi.registerCommand('quickinfo', {
      description: 'Display quickinfo modal with session metrics (tokens, context, cost, duration)',
      handler: async (_args: string, ctx: any) => {
        const state = ctx?.session?.state;
        let totalInput = 0;
        let totalOutput = 0;
        let totalCacheRead = 0;
        let totalCacheWrite = 0;
        let totalCost = 0;

        const entries = ctx?.session?.sessionManager?.getEntries?.() || [];
        for (const entry of entries) {
          if (entry.type === 'message' && entry.message.role === 'assistant') {
            totalInput += entry.message.usage?.input || 0;
            totalOutput += entry.message.usage?.output || 0;
            totalCacheRead += entry.message.usage?.cacheRead || 0;
            totalCacheWrite += entry.message.usage?.cacheWrite || 0;
            totalCost += entry.message.usage?.cost?.total || 0;
          }
        }

        const contextUsage = ctx?.session?.getContextUsage?.();
        const contextWindow = contextUsage?.contextWindow ?? state?.model?.contextWindow ?? 0;
        const pct = contextUsage?.percent !== null && contextUsage?.percent !== undefined
          ? `${contextUsage.percent.toFixed(1)}%`
          : '?';

        const fmtK = (n: number) => {
          if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
          if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
          return String(n);
        };

        const modalLines = [
          `╭────────────────── Session Quick Info ──────────────────╮`,
          `│ Model:    ${(state?.model?.id ?? 'default').padEnd(44)} │`,
          `│ Provider: ${(state?.model?.provider ?? 'unknown').padEnd(44)} │`,
          `│ Thinking: ${(state?.thinkingLevel ?? 'off').padEnd(44)} │`,
          `├────────────────────────────────────────────────────────┤`,
          `│ Context:  ${`${pct} / ${fmtK(contextWindow)} tokens`.padEnd(44)} │`,
          `│ Input:    ${`${fmtK(totalInput)} tokens`.padEnd(44)} │`,
          `│ Output:   ${`${fmtK(totalOutput)} tokens`.padEnd(44)} │`,
          `│ Cache R:  ${`${fmtK(totalCacheRead)} tokens`.padEnd(44)} │`,
          `│ Cache W:  ${`${fmtK(totalCacheWrite)} tokens`.padEnd(44)} │`,
          `├────────────────────────────────────────────────────────┤`,
          `│ Total Cost: ${`$${totalCost.toFixed(4)}`.padEnd(42)} │`,
          `│ Statusline: ${getStatuslineMode().padEnd(42)} │`,
          `╰────────────────────────────────────────────────────────╯`,
          `  (Press Esc or Enter to dismiss)`,
        ];

        // 1. If ctx.ui.custom is available, present as an interactive popup modal overlay
        if (typeof ctx?.ui?.custom === 'function') {
          try {
            await ctx.ui.custom((_tui: any, theme: any, _keybindings: any, done: (val: boolean) => void) => {
              const formatted = modalLines.map((line, idx) => {
                if (idx === 0 || idx === 4 || idx === 10 || idx === 13) {
                  return theme.fg('accent', line);
                }
                if (idx === 14) {
                  return theme.fg('dim', line);
                }
                return theme.fg('white', line);
              }).join('\n');

              const comp = new Text(formatted, 0, 0);
              // Handle dismiss keys
              (comp as any).handleInput = (key: string) => {
                if (key === 'escape' || key === 'return' || key === 'enter' || key === 'q') {
                  done(true);
                  return true;
                }
                return false;
              };
              return comp;
            }, { overlay: true });
            return;
          } catch {
            // fallback to notification
          }
        }

        // 2. Fallback to notification
        if (ctx?.ui?.notify) {
          ctx.ui.notify(modalLines.join('\n'), 'info');
        }
      },
    });
  }
}


