/**
 * `web-tools` extension entrypoint.
 *
 * Registers:
 * - `web_fetch`: URL fetching and extraction via flyscrape / Defuddle / Readability
 * - `web_search`: Search via ddgr / SearXNG
 * - `web_control`: Headless browser automation via browser-cli (Firefox / Browsh)
 * - `web_source`: Open source code and file search via Sourcegraph
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWebFetchTool } from "./src/web-fetch.ts";
import { registerWebSearchTool } from "./src/web-search.ts";
import { registerWebControlTool } from "./src/web-control.ts";
import { registerWebSourceTool } from "./src/web-source.ts";

export default function webToolsExtension(pi: ExtensionAPI): void {
  registerWebFetchTool(pi);
  registerWebSearchTool(pi);
  registerWebControlTool(pi);
  registerWebSourceTool(pi);
}
