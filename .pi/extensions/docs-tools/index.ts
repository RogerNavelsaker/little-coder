/**
 * `docs-tools` extension entrypoint.
 *
 * Registers:
 * - `doc_read`: Document conversion & parsing (Docling Serve / pdftotext / officeparser)
 * - `doc_ocr`: Optical Character Recognition (MiniCPM socket/URL / Tesseract)
 * - `doc_extract`: Structured data extraction to JSON (NuExtract socket/URL / pattern matcher)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDocReadTool } from "./src/doc-read.ts";
import { registerDocOcrTool } from "./src/doc-ocr.ts";
import { registerDocExtractTool } from "./src/doc-extract.ts";

export default function docsToolsExtension(pi: ExtensionAPI): void {
  registerDocReadTool(pi);
  registerDocOcrTool(pi);
  registerDocExtractTool(pi);
}
