import { describe, expect, it } from "bun:test";
import { isToolEnabled, getToolGatingConfig } from "./tool-gating.ts";

describe("_shared/tool-gating", () => {
  it("enables standard tools by default in coder role", () => {
    const env: NodeJS.ProcessEnv = {};
    expect(isToolEnabled("read", "basic", env)).toBe(true);
    expect(isToolEnabled("write", "basic", env)).toBe(true);
    expect(isToolEnabled("grove_read", "grove", env)).toBe(true);
    expect(isToolEnabled("grove_write", "grove", env)).toBe(true);
  });

  it("disables write and mutation tools when readonly role is specified", () => {
    const env: NodeJS.ProcessEnv = { LITTLE_CODER_ROLE: "reviewer" };
    expect(isToolEnabled("read", "basic", env)).toBe(true);
    expect(isToolEnabled("write", "basic", env)).toBe(false);
    expect(isToolEnabled("grove_read", "grove", env)).toBe(true);
    expect(isToolEnabled("grove_write", "grove", env)).toBe(false);
    expect(isToolEnabled("grove_promote", "grove", env)).toBe(false);
  });

  it("disables tools in explicit denylist", () => {
    const env: NodeJS.ProcessEnv = { LITTLE_CODER_DISABLED_TOOLS: "web_control,grove_write" };
    expect(isToolEnabled("web_control", "web", env)).toBe(false);
    expect(isToolEnabled("grove_write", "grove", env)).toBe(false);
    expect(isToolEnabled("web_search", "web", env)).toBe(true);
    expect(isToolEnabled("grove_read", "grove", env)).toBe(true);
  });

  it("enforces explicit allowlist when provided", () => {
    const env: NodeJS.ProcessEnv = { LITTLE_CODER_ENABLED_TOOLS: "read,grove_read" };
    expect(isToolEnabled("read", "basic", env)).toBe(true);
    expect(isToolEnabled("grove_read", "grove", env)).toBe(true);
    expect(isToolEnabled("write", "basic", env)).toBe(false);
    expect(isToolEnabled("grove_search", "grove", env)).toBe(false);
  });

  it("disables grove or web domains with category flags", () => {
    const env: NodeJS.ProcessEnv = { LITTLE_CODER_DISABLE_GROVE: "1" };
    expect(isToolEnabled("grove_read", "grove", env)).toBe(false);
    expect(isToolEnabled("grove_write", "grove", env)).toBe(false);
    expect(isToolEnabled("web_search", "web", env)).toBe(true);
  });
});
