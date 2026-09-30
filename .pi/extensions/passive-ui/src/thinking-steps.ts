/**
 * `thinking-steps` — Patches AssistantMessageComponent.prototype with reference-counted Symbol.
 *
 * Capabilities:
 * 1. Reference-counted prototype patching via Symbol.for('little-coder.thinking-steps.refCount').
 * 2. Parses and formats thinking traces into structured thinking steps.
 * 3. Coordinates with tool-execution-patch for spacer suppression before tool execution.
 * 4. Adheres to Universal Tool Contract (executeThinkingStepsOp, ops[] schema).
 */

import { Type } from '@sinclair/typebox';
import { AssistantMessageComponent, getMarkdownTheme, initTheme } from '@earendil-works/pi-coding-agent';
import { Markdown, Spacer, Text } from '@earendil-works/pi-tui';

export const THINKING_STEPS_REF_COUNT = Symbol.for('little-coder.thinking-steps.refCount');
export const THINKING_STEPS_ORIG_UPDATE = Symbol.for('little-coder.thinking-steps.origUpdateContent');

/**
 * Splits raw thinking trace text into logical thinking steps.
 */
export function parseThinkingSteps(rawThinking: string): string[] {
  if (!rawThinking || !rawThinking.trim()) return [];

  // Split on double newlines or common step headers (e.g. "Step 1:", "Thought 1:", "## ")
  const parts = rawThinking
    .split(/\n\s*\n|(?=(?:^|\n)(?:Step\s+\d+:|Thought\s+\d+:|##\s+))/i)
    .map(p => p.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [rawThinking.trim()];
}

/**
 * Format thinking step summary label for hidden thinking blocks.
 */
export function formatThinkingStepsLabel(stepCount: number, baseLabel = 'Thinking'): string {
  if (stepCount <= 1) {
    return `${baseLabel}...`;
  }
  return `${baseLabel} (${stepCount} steps)...`;
}

const formatThinkingText = (text: string) => `\x1b[3m\x1b[90m${text}\x1b[0m`;
const formatErrorText = (text: string) => `\x1b[31m${text}\x1b[0m`;

/**
 * Patch AssistantMessageComponent.prototype. Reference-counted via Symbol.
 */
export function patchAssistantMessageComponent(): number {
  const proto = AssistantMessageComponent.prototype as any;
  const currentCount = proto[THINKING_STEPS_REF_COUNT] ?? 0;

  if (currentCount > 0) {
    proto[THINKING_STEPS_REF_COUNT] = currentCount + 1;
    return proto[THINKING_STEPS_REF_COUNT];
  }

  // Store original updateContent
  proto[THINKING_STEPS_ORIG_UPDATE] = proto.updateContent;

  proto.updateContent = function (message: any) {
    this.lastMessage = message;
    this.contentContainer.clear();

    const hasVisibleContent = message?.content?.some(
      (c: any) => (c.type === 'text' && c.text?.trim()) || (c.type === 'thinking' && c.thinking?.trim())
    );

    if (hasVisibleContent) {
      this.contentContainer.addChild(new Spacer(1));
    }

    const items = message?.content || [];
    for (let i = 0; i < items.length; i++) {
      const content = items[i];

      if (content.type === 'text' && content.text?.trim()) {
        this.contentContainer.addChild(new Markdown(content.text.trim(), 1, 0, this.markdownTheme));
      } else if (content.type === 'thinking' && content.thinking?.trim()) {
        const hasVisibleContentAfter = items
          .slice(i + 1)
          .some((c: any) => (c.type === 'text' && c.text?.trim()) || (c.type === 'thinking' && c.thinking?.trim()));

        const steps = parseThinkingSteps(content.thinking);

        if (this.hideThinkingBlock) {
          const label = formatThinkingStepsLabel(steps.length, this.hiddenThinkingLabel || 'Thinking');
          this.contentContainer.addChild(new Text(formatThinkingText(label), 1, 0));
          if (hasVisibleContentAfter) {
            this.contentContainer.addChild(new Spacer(1));
          }
        } else {
          // Render thinking steps
          for (let sIdx = 0; sIdx < steps.length; sIdx++) {
            const stepText = steps[sIdx];
            const prefix = steps.length > 1 ? `✦ Step ${sIdx + 1}: ` : '';
            this.contentContainer.addChild(
              new Markdown(prefix + stepText, 1, 0, this.markdownTheme, {
                color: (text: string) => formatThinkingText(text),
                italic: true,
              })
            );
            if (sIdx < steps.length - 1) {
              this.contentContainer.addChild(new Spacer(1));
            }
          }

          if (hasVisibleContentAfter) {
            this.contentContainer.addChild(new Spacer(1));
          }
        }
      }
    }

    const hasToolCalls = items.some((c: any) => c.type === 'toolCall');
    this.hasToolCalls = hasToolCalls;

    if (!hasToolCalls && message?.errorMessage) {
      const abortMessage = message.errorMessage !== 'Request was aborted' ? message.errorMessage : null;
      if (abortMessage) {
        this.contentContainer.addChild(new Spacer(1));
        this.contentContainer.addChild(new Text(formatErrorText(abortMessage), 1, 0));
      }
    }
  };

  proto[THINKING_STEPS_REF_COUNT] = 1;
  return 1;
}

/**
 * Decrement reference count and unpatch if count reaches 0.
 */
export function unpatchAssistantMessageComponent(): number {
  const proto = AssistantMessageComponent.prototype as any;
  const currentCount = proto[THINKING_STEPS_REF_COUNT] ?? 0;

  if (currentCount <= 1) {
    if (proto[THINKING_STEPS_ORIG_UPDATE]) {
      proto.updateContent = proto[THINKING_STEPS_ORIG_UPDATE];
      delete proto[THINKING_STEPS_ORIG_UPDATE];
    }
    proto[THINKING_STEPS_REF_COUNT] = 0;
    return 0;
  }

  proto[THINKING_STEPS_REF_COUNT] = currentCount - 1;
  return proto[THINKING_STEPS_REF_COUNT];
}

export function getThinkingStepsPatchRefCount(): number {
  const proto = AssistantMessageComponent.prototype as any;
  return proto[THINKING_STEPS_REF_COUNT] ?? 0;
}

export const thinkingStepsItemSchema = Type.Object({
  rawThinking: Type.String({ description: 'Raw thinking text to parse' }),
  baseLabel: Type.Optional(Type.String({ description: 'Base label for thinking indicator' })),
});

export const thinkingStepsSchema = Type.Object({
  ops: Type.Optional(Type.Array(thinkingStepsItemSchema, { description: 'Batch operations array' })),
  rawThinking: Type.Optional(Type.String({ description: 'Raw thinking text to parse' })),
  baseLabel: Type.Optional(Type.String({ description: 'Base label for thinking indicator' })),
});

export async function executeThinkingStepsOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  _ctx?: any
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeThinkingStepsOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, _ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeThinkingStepsOp(_toolCallId, op, _signal, _onUpdate, _ctx))
    );
    return {
      content: [{ type: 'text' as const, text: results.map(r => r.content[0].text).join('\n---\n') }],
      isError: false,
      details: {
        totalOps: results.length,
        results: results.map(r => r.details),
      },
    };
  }

  const rawThinking = params.rawThinking ?? '';
  const steps = parseThinkingSteps(rawThinking);
  const baseLabel = params.baseLabel ?? 'Thinking';
  const label = formatThinkingStepsLabel(steps.length, baseLabel);

  const formatted = steps.map((s, idx) => `[Step ${idx + 1}] ${s}`).join('\n');

  return {
    content: [{ type: 'text' as const, text: formatted || '(empty thinking trace)' }],
    isError: false,
    details: {
      totalSteps: steps.length,
      steps,
      label,
      patchRefCount: getThinkingStepsPatchRefCount(),
    },
  };
}
