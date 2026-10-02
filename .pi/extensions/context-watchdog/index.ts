import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerContextWatchdog } from "./src/context-watchdog.ts";

export default function contextWatchdogExtension(pi: ExtensionAPI): void {
  registerContextWatchdog(pi);
}
