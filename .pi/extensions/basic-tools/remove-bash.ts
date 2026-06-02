/**
 * pi-remove-bash
 *
 * Extension: Remove built-in bash from the active tool surface.
 *
 * When pi-structural-tools provides `shell` (Nushell-backed), the built-in
 * `bash` tool is redundant. This extension uses the supported
 * `pi.setActiveTools()` API to remove bash from the active tool list.
 *
 * Uses `resources_discover` (fires during startup after extensions are loaded)
 * to modify the active tool set. The LLM sees:
 *
 *   read, edit, write, grep, find, ls, shell, ast_search, ctx_record, ctx_packet
 *
 * without bash.
 *
 * This is a no-op if bash is already absent from the active tools.
 *
 * Usage:
 *   pi -ne -e ~/.pi/agent/pi-structural-tools -e ~/.pi/agent/pi-context \
 *      -e ~/.pi/agent/extensions/pi-remove-bash.ts -p "..."
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function (pi: ExtensionAPI) {
  pi.on("resources_discover", async (_event, _ctx) => {
    const activeNames = pi.getActiveTools() as string[];

    // Only modify if bash is present and shell is available
    if (!activeNames.includes("bash")) return;
    if (!activeNames.includes("shell")) return;

    const next = activeNames.filter((name) => name !== "bash");
    pi.setActiveTools(next);
  });
}
