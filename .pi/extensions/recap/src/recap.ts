/**
 * `recap` tool — Uniform narration & progress checkpointing with italic styling.
 *
 * Provides a dedicated narration tool for models to announce phase changes,
 * intent milestones, and progress checkpoints. Rendered with distinctive italic styling.
 */

import { Type } from '@sinclair/typebox';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Text } from '@earendil-works/pi-tui';

export const recapSchema = Type.Object({
  message: Type.String({
    description: 'Concise narration of progress, plan checkpoint, or major intent transition.',
  }),
});

export interface RecapParams {
  message: string;
}

export function registerRecapTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'recap',
    label: 'Recap',
    description:
      'Announce a concise progress narration, plan checkpoint, or intent transition for the user. Renders in distinctive italic style.',
    promptSnippet: 'Narrate intent, progress checkpoints, and phase transitions',
    promptGuidelines: [
      'Use recap to announce major phase transitions or summarise multi-step plans before running tool pipelines.',
      'Keep recap messages concise and focused on high-level direction (1-2 sentences).',
    ],
    parameters: recapSchema,

    renderCall(args: any, theme: any) {
      const msg = args?.message || '';
      const italicFn = theme.italic ? theme.italic : (t: string) => `\x1b[3m${t}\x1b[23m`;
      const text = theme.fg('toolTitle', 'recap ') + theme.fg('muted', italicFn(`"${msg}"`));
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const msg = result?.details?.message || (result?.content?.[0] as any)?.text || '';
      const italicFn = theme.italic ? theme.italic : (t: string) => `\x1b[3m${t}\x1b[23m`;
      const prefix = theme.fg('accent', '💬 ');
      const text = prefix + theme.fg('dim', italicFn(msg));
      return new Text(text, 0, 0);
    },

    async execute(_toolCallId: string, params: any) {
      const message = String(params?.message ?? '').trim();
      return {
        content: [{ type: 'text', text: message }],
        isError: false,
        details: { message },
      };
    },
  });

  // System prompt discipline: inject guidance into before_agent_start
  pi.on('before_agent_start', async (event: any) => {
    const discipline =
      '\n\n[Narration Discipline]\nUse the `recap` tool to narrate major sub-goals, intent transitions, or complex multi-step pipelines before executing them, keeping the user oriented.';
    if (event?.systemPrompt) {
      return {
        systemPrompt: event.systemPrompt + discipline,
      };
    }
    return undefined;
  });
}
