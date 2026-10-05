/**
 * `tool-execution-patch` — UI patch for Pi's ToolExecutionComponent.
 *
 * Capabilities:
 * 1. Suppresses leading blank spacer lines when tool cards are grouped or consecutive.
 * 2. Allows registering third-party tool definition overrides (renderCall, renderResult, renderShell)
 *    via registerToolDefinitionOverride(toolName, definition).
 */

import { FooterComponent, ToolExecutionComponent } from '@earendil-works/pi-coding-agent';
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

declare global {
  // eslint-disable-next-line no-var
  var __littleCoderToolOverrides: Map<string, any> | undefined;
  // eslint-disable-next-line no-var
  var __littleCoderStatuslineMode: StatuslineMode | undefined;
}

export type StatuslineMode = 'minimal' | 'standard' | 'full' | 'off';

/**
 * Get the current statusline mode.
 * Default: 'minimal' (repo · model · context%)
 */
export function getStatuslineMode(): StatuslineMode {
  return globalThis.__littleCoderStatuslineMode ?? 'minimal';
}

/**
 * Set the statusline mode ('minimal' | 'standard' | 'full' | 'off').
 */
export function setStatuslineMode(mode: StatuslineMode): void {
  globalThis.__littleCoderStatuslineMode = mode;
}

/**
 * Toggle detailed statusline mode (cycles minimal -> full -> minimal).
 */
export function toggleDetailedStatusline(detailed?: boolean): boolean {
  if (detailed !== undefined) {
    globalThis.__littleCoderStatuslineMode = detailed ? 'full' : 'minimal';
  } else {
    const cur = getStatuslineMode();
    globalThis.__littleCoderStatuslineMode = cur === 'full' ? 'minimal' : 'full';
  }
  return globalThis.__littleCoderStatuslineMode === 'full';
}

export function isDetailedStatusline(): boolean {
  return getStatuslineMode() === 'full';
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

/**
 * Patch FooterComponent to format statusline nicely like Codex:
 * Single line, distinct colored segments, clear chosen data:
 * `~/repo (main) · GPT-6-Luna (openai-codex) · 57.4% (auto) · ↑4.9M ↓410k R68M · $0.000 (sub)`
 */
export function patchFooterComponent(): void {
  const proto = FooterComponent.prototype as any;
  if (proto.__littleCoderFooterPatched) return;

  const origRender = proto.render;
  proto.render = function (width: number) {
    const rawLines: string[] = origRender.call(this, width);
    if (!rawLines || rawLines.length === 0) return rawLines;

    const state = this.session?.state;
    if (!state) return rawLines;

    const theme = (this as any).theme || {
      fg: (_color: string, text: string) => text,
      bold: (text: string) => text,
    };

    // Calculate usage from all entries
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let totalCost = 0;
    for (const entry of this.session.sessionManager.getEntries()) {
      if (entry.type === 'message' && entry.message.role === 'assistant') {
        totalInput += entry.message.usage?.input || 0;
        totalOutput += entry.message.usage?.output || 0;
        totalCacheRead += entry.message.usage?.cacheRead || 0;
        totalCacheWrite += entry.message.usage?.cacheWrite || 0;
        totalCost += entry.message.usage?.cost?.total || 0;
      }
    }

    const fmtTokens = (count: number) => {
      if (count < 1000) return count.toString();
      if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
      if (count < 1000000) return `${Math.round(count / 1000)}k`;
      if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
      return `${Math.round(count / 1000000)}M`;
    };

    // Context usage
    const contextUsage = this.session.getContextUsage();
    const contextWindow = contextUsage?.contextWindow ?? state.model?.contextWindow ?? 0;
    const contextPercentValue = contextUsage?.percent ?? 0;
    const contextPercent = contextUsage?.percent !== null && contextUsage?.percent !== undefined
      ? contextPercentValue.toFixed(1)
      : '?';

    // 1. Path & Git (shorten long paths to `.../basename (branch)` if long)
    let pwd = rawLines[0]?.replace(/\x1b\[[0-9;]*m/g, '').trim() || '~';
    if (pwd.length > 28) {
      const branchMatch = pwd.match(/\s*\([^)]+\)$/);
      const branch = branchMatch ? branchMatch[0] : '';
      const pathPart = branchMatch ? pwd.slice(0, branchMatch.index).trim() : pwd;
      const parts = pathPart.split('/').filter(Boolean);
      if (parts.length > 2) {
        pwd = `…/${parts.slice(-2).join('/')}${branch}`;
      }
    }
    const pwdSegment = `\x1b[38;2;138;190;183m${pwd}\x1b[0m`;

    // 2. Model & Role
    const modelName = state.model?.id || 'no-model';
    const provider = state.model?.provider ? ` (${state.model.provider})` : '';
    const thinkingLevel = state.thinkingLevel && state.thinkingLevel !== 'off' ? ` • ${state.thinkingLevel}` : '';
    const modelSegment = `\x1b[38;2;184;152;50m${modelName}${provider}${thinkingLevel}\x1b[0m`;

    // 3. Context % with threshold colors
    let ctxColor = '\x1b[38;2;149;152;203m'; // muted purple/blue like Codex
    if (contextPercentValue > 90) ctxColor = '\x1b[31m';
    else if (contextPercentValue > 70) ctxColor = '\x1b[33m';
    const autoIndicator = this.autoCompactEnabled ? ' (auto)' : '';
    const ctxSegment = `${ctxColor}Context ${contextPercent}%/${fmtTokens(contextWindow)}${autoIndicator}\x1b[0m`;

    // 4. Token metrics (cyan / muted)
    const tokenParts: string[] = [];
    if (totalInput) tokenParts.push(`↑${fmtTokens(totalInput)}`);
    if (totalOutput) tokenParts.push(`↓${fmtTokens(totalOutput)}`);
    if (totalCacheRead) tokenParts.push(`R${fmtTokens(totalCacheRead)}`);
    if (totalCacheWrite) tokenParts.push(`W${fmtTokens(totalCacheWrite)}`);
    const tokenSegment = tokenParts.length > 0
      ? `\x1b[38;2;129;162;190m${tokenParts.join(' ')}\x1b[0m`
      : '';

    // 5. Cost
    const usingSubscription = state.model ? this.session.modelRegistry.isUsingOAuth(state.model) : false;
    let costSegment = '';
    if (totalCost || usingSubscription) {
      costSegment = `\x1b[38;2;181;189;104m$${totalCost.toFixed(3)}${usingSubscription ? ' (sub)' : ''}\x1b[0m`;
    }

    const mode = getStatuslineMode();
    if (mode === 'off') {
      return [];
    }

    const dot = ' \x1b[38;2;102;102;102m·\x1b[0m ';

    // Segments according to StatuslineMode:
    // minimal:  [pwd, model, context%]
    // standard: [pwd, model, context%, tokens]
    // full:     [pwd, model, context%, tokens, cost]
    let activeSegments: string[];
    if (mode === 'full' || width >= 160) {
      activeSegments = [pwdSegment, modelSegment, ctxSegment, tokenSegment, costSegment].filter(Boolean);
    } else if (mode === 'standard') {
      activeSegments = [pwdSegment, modelSegment, ctxSegment, tokenSegment].filter(Boolean);
    } else {
      // minimal (default)
      activeSegments = [pwdSegment, modelSegment, ctxSegment].filter(Boolean);
    }
    let leftText = activeSegments.join(dot);

    // Right side: extension statuses if any
    let rightText = '';
    const extensionStatuses = this.footerData?.getExtensionStatuses();
    if (extensionStatuses && extensionStatuses.size > 0) {
      const entries = Array.from(extensionStatuses.entries()) as [string, any][];
      const sorted = entries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, t]) => String(t).replace(/[\r\n\t]/g, ' ').trim());
      rightText = `\x1b[38;2;150;156;167m${sorted.join(' ')}\x1b[0m`;
    }

    let leftLen = visibleWidth(leftText);
    let rightLen = visibleWidth(rightText);

    // If too wide for terminal, try dropping extension status first
    if (leftLen + (rightLen ? rightLen + 2 : 0) > width && rightLen > 0) {
      rightText = '';
      rightLen = 0;
    }

    // If still too wide, drop cost, then tokens
    if (leftLen > width && costSegment) {
      activeSegments = [pwdSegment, modelSegment, ctxSegment, tokenSegment].filter(Boolean);
      leftText = activeSegments.join(dot);
      leftLen = visibleWidth(leftText);
    }
    if (leftLen > width && tokenSegment) {
      activeSegments = [pwdSegment, modelSegment, ctxSegment].filter(Boolean);
      leftText = activeSegments.join(dot);
      leftLen = visibleWidth(leftText);
    }

    if (leftLen + (rightLen ? rightLen + 2 : 0) <= width) {
      const pad = ' '.repeat(Math.max(1, width - leftLen - rightLen));
      return [leftText + (rightText ? pad + rightText : '')];
    }

    return [truncateToWidth(leftText, width, '...')];
  };

  proto.__littleCoderFooterPatched = true;
}

// Automatically apply runtime patches when imported
patchToolExecutionComponent();
patchFooterComponent();
