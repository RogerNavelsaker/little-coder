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
import { Container, Text, matchesKey } from '@earendil-works/pi-tui';
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
  getStatuslineItems,
  setStatuslineItems,
  type StatuslineMode,
  type StatuslineItems,
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

  // Register /statusline command: interactive selector menu or quick argument switch
  if (typeof pi.registerCommand === 'function') {
    pi.registerCommand('statusline', {
      description: 'Configure statusline preset or toggle elements: /statusline [minimal|standard|full|off]',
      handler: async (args: string, ctx: any) => {
        const target = (args || '').trim().toLowerCase();
        if (target === 'minimal' || target === 'standard' || target === 'full' || target === 'custom' || target === 'off') {
          setStatuslineMode(target as StatuslineMode);
          saveStatuslineSetting(target as StatuslineMode, getStatuslineItems(), ctx?.cwd || process.cwd());
          if (typeof ctx?.ui?.requestRender === 'function') {
            ctx.ui.requestRender();
          }
          if (ctx?.ui?.notify) {
            ctx.ui.notify(`Statusline mode set and saved to: ${target}`, 'info');
          }
          return;
        }

        // TUI interactive selector modal:
        // Section 1: Presets (Minimal, Standard, Full, Custom, Off)
        // Section 2: Toggleable components (when Custom or modifying custom)
        const presets: Array<{ id: StatuslineMode; title: string; desc: string }> = [
          { id: 'minimal', title: 'Minimal (Default)', desc: '…/repo (branch) · model · Context X%' },
          { id: 'standard', title: 'Standard', desc: '…/repo (branch) · model · Context X% · ↑↓ tokens' },
          { id: 'full', title: 'Full (Detailed)', desc: '…/repo (branch) · model · Context X% · ↑↓ tokens · $cost' },
          { id: 'custom', title: 'Custom (Configured below)', desc: 'Toggle individual elements below' },
          { id: 'off', title: 'Off', desc: 'Disable statusline completely' },
        ];

        const itemDefs: Array<{ key: keyof StatuslineItems; label: string; desc: string }> = [
          { key: 'cwd', label: 'current-dir & git-branch', desc: 'Working directory path and current git branch' },
          { key: 'model', label: 'model-with-reasoning', desc: 'Current model name, provider, and thinking level' },
          { key: 'context', label: 'context-used', desc: 'Percentage of context window used and token total' },
          { key: 'tokens', label: 'traffic-tokens', desc: 'Total input, output, and cache read/write tokens' },
          { key: 'cost', label: 'estimated-cost', desc: 'Total estimated session cost in USD or subscription indicator' },
          { key: 'extension_status', label: 'extension-statuses', desc: 'Right-aligned active extension states' },
        ];

        // Flat list of rows for the menu
        type MenuRow =
          | { type: 'preset'; preset: (typeof presets)[number] }
          | { type: 'item'; item: (typeof itemDefs)[number] };

        const rows: MenuRow[] = [
          ...presets.map(p => ({ type: 'preset' as const, preset: p })),
          ...itemDefs.map(i => ({ type: 'item' as const, item: i })),
        ];

        let currentMode = getStatuslineMode();
        let currentItems = { ...getStatuslineItems() };
        let selectedIndex = presets.findIndex(p => p.id === currentMode);
        if (selectedIndex === -1) selectedIndex = 0;

        if (typeof ctx?.ui?.custom === 'function') {
          try {
            await ctx.ui.custom((_tui: any, theme: any, _keybindings: any, done: (val: boolean) => void) => {
              const comp: any = new Text('', 0, 0);

              const updateText = () => {
                const lines = [
                  '╭──────────────────────── Configure Status Line ────────────────────────╮',
                  '│ Select preset or press Space to toggle items. Enter to save.          │',
                  '├───────────────────────────────────────────────────────────────────────┤',
                ];

                for (let i = 0; i < rows.length; i++) {
                  const row = rows[i];
                  const isCursor = i === selectedIndex;
                  const cursorGlyph = isCursor ? '❯' : ' ';

                  if (i === presets.length) {
                    lines.push('├─ Toggle Components (Space to toggle) ─────────────────────────────────┤');
                  }

                  if (row.type === 'preset') {
                    const isActive = row.preset.id === currentMode;
                    const check = isActive ? '[●]' : '[○]';
                    const titleText = `${cursorGlyph} ${check} ${row.preset.title}`;
                    const paddedTitle = titleText.padEnd(71);
                    const paddedDesc = `      ${row.preset.desc}`.padEnd(71);

                    if (isCursor) {
                      lines.push(`│ ${theme.fg('accent', paddedTitle)} │`);
                      lines.push(`│ ${theme.fg('muted', paddedDesc)} │`);
                    } else {
                      lines.push(`│ ${theme.fg(isActive ? 'success' : 'white', paddedTitle)} │`);
                      lines.push(`│ ${theme.fg('dim', paddedDesc)} │`);
                    }
                  } else {
                    const isChecked = Boolean(currentItems[row.item.key]);
                    const check = isChecked ? '[x]' : '[ ]';
                    const titleText = `${cursorGlyph} ${check} ${row.item.label}`;
                    const paddedTitle = titleText.padEnd(71);
                    const paddedDesc = `      ${row.item.desc}`.padEnd(71);

                    if (isCursor) {
                      lines.push(`│ ${theme.fg('accent', paddedTitle)} │`);
                      lines.push(`│ ${theme.fg('muted', paddedDesc)} │`);
                    } else {
                      lines.push(`│ ${theme.fg(isChecked ? 'white' : 'dim', paddedTitle)} │`);
                      lines.push(`│ ${theme.fg('dim', paddedDesc)} │`);
                    }
                  }
                }

                lines.push('├───────────────────────────────────────────────────────────────────────┤');
                lines.push('│ Space: Toggle element · Enter: Save & Close · Esc/q: Cancel           │');
                lines.push('╰───────────────────────────────────────────────────────────────────────╯');

                comp.text = lines.join('\n');
              };

              updateText();

              comp.handleInput = (key: string) => {
                if (key === 'up' || key === 'k' || matchesKey(key, 'up')) {
                  selectedIndex = (selectedIndex - 1 + rows.length) % rows.length;
                  updateText();
                  return true;
                }
                if (key === 'down' || key === 'j' || matchesKey(key, 'down')) {
                  selectedIndex = (selectedIndex + 1) % rows.length;
                  updateText();
                  return true;
                }
                if (key === 'space' || key === ' ' || matchesKey(key, 'space')) {
                  const row = rows[selectedIndex];
                  if (row.type === 'item') {
                    currentItems[row.item.key] = !currentItems[row.item.key];
                    currentMode = 'custom';
                    setStatuslineItems(currentItems);
                    setStatuslineMode('custom');
                    updateText();
                    return true;
                  }
                  if (row.type === 'preset') {
                    currentMode = row.preset.id;
                    setStatuslineMode(currentMode);
                    updateText();
                    return true;
                  }
                }
                if (key === 'return' || key === 'enter' || matchesKey(key, 'enter')) {
                  const row = rows[selectedIndex];
                  if (row.type === 'preset') {
                    currentMode = row.preset.id;
                  } else {
                    currentMode = 'custom';
                  }
                  setStatuslineMode(currentMode);
                  setStatuslineItems(currentItems);
                  saveStatuslineSetting(currentMode, currentItems, ctx?.cwd || process.cwd());
                  if (typeof ctx?.ui?.requestRender === 'function') {
                    ctx.ui.requestRender();
                  }
                  if (ctx?.ui?.notify) {
                    ctx.ui.notify(`Statusline updated: ${currentMode}`, 'info');
                  }
                  done(true);
                  return true;
                }
                if (key === 'escape' || key === 'q' || matchesKey(key, 'escape')) {
                  done(false);
                  return true;
                }
                return false;
              };

              return comp;
            });
            return;
          } catch {
            // fallback to notification
          }
        }

        const current = getStatuslineMode();
        const items = getStatuslineItems();
        const msg = [
          `Current statusline mode: ${current}`,
          `Components:`,
          `  cwd:              ${items.cwd ? 'enabled' : 'disabled'}`,
          `  model:            ${items.model ? 'enabled' : 'disabled'}`,
          `  context:          ${items.context ? 'enabled' : 'disabled'}`,
          `  tokens:           ${items.tokens ? 'enabled' : 'disabled'}`,
          `  cost:             ${items.cost ? 'enabled' : 'disabled'}`,
          `  extension_status: ${items.extension_status ? 'enabled' : 'disabled'}`,
          ``,
          `Presets: /statusline [minimal|standard|full|custom|off]`,
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


