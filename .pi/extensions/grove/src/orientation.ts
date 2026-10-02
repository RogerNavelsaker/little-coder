/**
 * Orientation Block Synthesizer.
 *
 * Cold-start detection via seeds/trellis/mulch:
 * If a session starts or the agent has been idle >1 hour, synthesizes an
 * [ORIENTATION] block into the conversation tail containing:
 * - Active / unblocked issues (`seeds ready`)
 * - In-progress issue (if any)
 * - Key project expertise priming pointer
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface OrientationState {
  lastActivityTimestamp: number;
}

export function synthesizeOrientationBlock(cwd: string = process.cwd()): string | undefined {
  if (!existsSync(resolve(cwd, ".seeds")) && !existsSync(resolve(cwd, ".mulch"))) {
    return undefined;
  }

  const sections: string[] = ["[ORIENTATION]"];

  // 1. Ready issues
  try {
    const readyProc = spawnSync("seeds", ["ready", "--json"], { cwd, encoding: "utf-8" });
    if (readyProc.status === 0 && readyProc.stdout) {
      const parsed = JSON.parse(readyProc.stdout);
      const issues = parsed.issues || [];
      if (issues.length > 0) {
        sections.push(
          `• Ready issues (${issues.length}): ` +
            issues.slice(0, 3).map((i: any) => `${i.id} (${i.title})`).join(", "),
        );
      }
    }
  } catch {}

  // 2. In-progress work
  try {
    const inProgProc = spawnSync("seeds", ["list", "--status", "in_progress", "--json"], {
      cwd,
      encoding: "utf-8",
    });
    if (inProgProc.status === 0 && inProgProc.stdout) {
      const parsed = JSON.parse(inProgProc.stdout);
      const issues = parsed.issues || [];
      if (issues.length > 0) {
        sections.push(`• In progress: ${issues.map((i: any) => `${i.id}: ${i.title}`).join(", ")}`);
      }
    }
  } catch {}

  // 3. Quick start directive
  sections.push("• Grove commands: sd ready | sd show <id> | ml query architecture | ml prime");

  return sections.join("\n");
}
