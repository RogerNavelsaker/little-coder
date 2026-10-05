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
    let lines = origRender.call(this, width);
    if (this.suppressLeadingSpacer || this.isGrouped) {
      if (lines.length > 0 && lines[0] === '') {
        lines.shift();
      }
    }

    // 1-Line Compact consolidation: if not expanded and lines consist of [callHeader, '', resultSummary]
    // or [callHeader, resultSummary], inline them into a single line like: `├ ❯ <cmd>  (323ms: summary)`
    if (!this.expanded && lines.length >= 2 && lines.length <= 4) {
      const nonBlank = lines.filter((l: string) => l.trim().length > 0);
      if (nonBlank.length === 2) {
        const line1 = nonBlank[0];
        const line2 = nonBlank[1].trim();
        // Only compact if combined line comfortably fits the terminal width
        const plain1 = line1.replace(/\x1b\[[0-9;]*m/g, '');
        const plain2 = line2.replace(/\x1b\[[0-9;]*m/g, '');
        if (plain1.length + plain2.length + 3 <= width) {
          lines = [`${line1}  \x1b[2m(${line2})\x1b[0m`];
        }
      }
    }

    // Codex/Tree connector glyph: If tool is grouped and has multiple lines (e.g. output diff or results),
    // connect line 2..N with '│ ' so the tree visual remains unbroken from ┌ / ├ down to └.
    if ((this.isGrouped || this.suppressLeadingSpacer) && lines.length > 1) {
      const isLast = Boolean(this.isLast);
      const connectorPrefix = isLast ? '  ' : '\x1b[1m\x1b[37m│\x1b[0m ';
      lines = lines.map((l: string, idx: number) => {
        if (idx === 0) return l;
        // Don't double-prefix if already prefixed
        if (l.startsWith('│ ') || l.startsWith('├ ') || l.startsWith('└ ') || l.startsWith('┌ ')) return l;
        return `${connectorPrefix}${l}`;
      });
    }

    return lines;
  };

  const origHasRendererDefinition = proto.hasRendererDefinition;
  proto.hasRendererDefinition = function () {
    if (globalThis.__littleCoderToolOverrides?.has(this.toolName)) return true;
    return origHasRendererDefinition ? origHasRendererDefinition.call(this) : false;
  };

  const origGetRenderContext = proto.getRenderContext;
  proto.getRenderContext = function (lastComponent: any) {
    const ctx = origGetRenderContext.call(this, lastComponent);
    ctx.component = this;
    return ctx;
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

  const origUpdateDisplay = proto.updateDisplay;
  proto.updateDisplay = function () {
    if (origUpdateDisplay) {
      origUpdateDisplay.call(this);
    }
    // Neutralize loud tool card backgrounds: Codex and AGY use clean, neutral, un-tinted tool rows.
    // Replace aggressive red/green/dark-grey full-width background box styling with neutral/transparent styling.
    if (this.contentBox && typeof this.contentBox.setBgFn === 'function') {
      this.contentBox.setBgFn((text: string) => text);
      this.contentBox.paddingY = 0;
    }
    if (this.contentText && typeof this.contentText.setCustomBgFn === 'function') {
      this.contentText.setCustomBgFn((text: string) => text);
    }
  };

  proto.__littleCoderPatched = true;
}

// Automatically apply runtime patch when imported
patchToolExecutionComponent();
