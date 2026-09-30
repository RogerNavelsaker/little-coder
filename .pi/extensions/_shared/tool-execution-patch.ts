/**
 * `tool-execution-patch` — UI patch for Pi's ToolExecutionComponent.
 *
 * Capabilities:
 * 1. Suppresses leading blank spacer lines when tool cards are grouped or consecutive.
 * 2. Allows registering third-party tool definition overrides (renderCall, renderResult, renderShell)
 *    via registerToolDefinitionOverride(toolName, definition).
 */

import { ToolExecutionComponent } from '@earendil-works/pi-coding-agent';

declare global {
  // eslint-disable-next-line no-var
  var __littleCoderToolOverrides: Map<string, any> | undefined;
}

/**
 * Register a tool definition override for custom or third-party tool rendering.
 */
export function registerToolDefinitionOverride(toolName: string, definition: any): void {
  if (!globalThis.__littleCoderToolOverrides) {
    globalThis.__littleCoderToolOverrides = new Map();
  }
  globalThis.__littleCoderToolOverrides.set(toolName, definition);
}

/**
 * Get registered tool definition override if present.
 */
export function getToolDefinitionOverride(toolName: string): any | undefined {
  return globalThis.__littleCoderToolOverrides?.get(toolName);
}

/**
 * Clear all registered tool definition overrides.
 */
export function clearToolDefinitionOverrides(): void {
  globalThis.__littleCoderToolOverrides?.clear();
}

/**
 * Patch ToolExecutionComponent prototype at runtime.
 * Ensures:
 * - Leading blank line (from constructor Spacer) is suppressed when suppressLeadingSpacer or isGrouped is set.
 * - getCallRenderer and getResultRenderer honor toolDefinitionOverrides.
 */
export function patchToolExecutionComponent(): void {
  const proto = ToolExecutionComponent.prototype as any;
  if (proto.__littleCoderPatched) return;

  const origRender = proto.render;
  proto.render = function (width: number) {
    if (this.hideComponent) return [];
    const lines = origRender.call(this, width);
    if (this.suppressLeadingSpacer || this.isGrouped) {
      if (lines.length > 0 && lines[0] === '') {
        lines.shift();
      }
    }
    return lines;
  };

  const origGetCallRenderer = proto.getCallRenderer;
  proto.getCallRenderer = function () {
    const override = globalThis.__littleCoderToolOverrides?.get(this.toolName);
    if (override?.renderCall) return override.renderCall;
    return origGetCallRenderer.call(this);
  };

  const origGetResultRenderer = proto.getResultRenderer;
  proto.getResultRenderer = function () {
    const override = globalThis.__littleCoderToolOverrides?.get(this.toolName);
    if (override?.renderResult) return override.renderResult;
    return origGetResultRenderer.call(this);
  };

  proto.__littleCoderPatched = true;
}

// Automatically apply runtime patch when imported
patchToolExecutionComponent();
