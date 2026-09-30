import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerProjectContextTool } from "./src/project-context.ts";

export default function projectContextExtension(pi: ExtensionAPI): void {
  registerProjectContextTool(pi);
}
