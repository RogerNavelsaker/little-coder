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
}
