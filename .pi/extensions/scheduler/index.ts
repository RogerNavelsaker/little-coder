/**
 * `scheduler` extension entrypoint.
 *
 * Registers:
 * - `schedule` tool: for model-initiated timers, reminders, and recurring checks.
 * - `/schedule` command: for user-initiated delayed prompts.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerScheduleTool } from "./src/schedule.ts";

export default function schedulerExtension(pi: ExtensionAPI): void {
  registerScheduleTool(pi);
}
