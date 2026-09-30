import { describe, expect, it } from "bun:test";
import { injectMode, injectionResult, makeDedupe } from "./inject.ts";

const messageMode = {} as NodeJS.ProcessEnv;
const systemMode = { LITTLE_CODER_INJECT_MODE: "system" } as NodeJS.ProcessEnv;

describe("injectMode", () => {
  it("defaults to tail-message delivery", () => {
    expect(injectMode(messageMode)).toBe("message");
    expect(injectMode({ LITTLE_CODER_INJECT_MODE: "" } as NodeJS.ProcessEnv)).toBe("message");
    expect(injectMode({ LITTLE_CODER_INJECT_MODE: "msg" } as NodeJS.ProcessEnv)).toBe("message");
  });

  it("honors the LITTLE_CODER_INJECT_MODE=system escape hatch", () => {
    expect(injectMode(systemMode)).toBe("system");
  });
});

describe("injectionResult", () => {
  it("returns a hidden tail message and never touches the system prompt", () => {
    const result = injectionResult("lc-project-context", "GUIDANCE", "SYSTEM", messageMode);
    expect(result).toEqual({
      message: { customType: "lc-project-context", content: "GUIDANCE", display: false },
    });
    expect(result?.systemPrompt).toBeUndefined();
  });

  it("appends to the system prompt in system mode", () => {
    expect(injectionResult("lc-project-context", "GUIDANCE", "SYSTEM", systemMode)).toEqual({
      systemPrompt: "SYSTEMGUIDANCE",
    });
  });

  it("returns undefined for an empty block in either mode", () => {
    expect(injectionResult("lc-project-context", "", "SYSTEM", messageMode)).toBeUndefined();
    expect(injectionResult("lc-project-context", "", "SYSTEM", systemMode)).toBeUndefined();
  });
});

describe("makeDedupe", () => {
  it("suppresses a block identical to the previous one", () => {
    const should = makeDedupe(messageMode);
    expect(should("A")).toBe(true);
    expect(should("A")).toBe(false);
    expect(should("B")).toBe(true);
    expect(should("B")).toBe(false);
    expect(should("A")).toBe(true);
  });

  it("never suppresses in system mode, where the prompt is rebuilt each turn", () => {
    const should = makeDedupe(systemMode);
    expect(should("A")).toBe(true);
    expect(should("A")).toBe(true);
  });

  it("keeps separate state per injector", () => {
    const a = makeDedupe(messageMode);
    const b = makeDedupe(messageMode);
    expect(a("A")).toBe(true);
    expect(b("A")).toBe(true);
  });
});
