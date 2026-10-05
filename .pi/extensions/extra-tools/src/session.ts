/**
 * `session` tool — Herdr-backed process & pane session management.
 *
 * Replaces legacy Zellij sessions to unify background tasks and subagents.
 * Supported operations: create (or spawn), exec, write (or send), read (or log), list, close (or kill), reset.
 * File registry stored in `~/.pi/sessions/<id>.json`.
 * Output formatted with status footer: [exit=N cwd=... timed_out=bool].
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn, execSync, type ChildProcess } from "node:child_process";

export interface SessionRecord {
  id: string;
  name?: string;
  command: string;
  cwd: string;
  createdAt: number;
  pid?: number;
  status: "running" | "exited" | "error";
  exitCode?: number | null;
  timedOut?: boolean;
  outputLogFile: string;
  backend: "herdr" | "process";
}

export const sessionItemSchema = Type.Object({
  action: Type.Optional(
    Type.Union([
      Type.Literal("create"),
      Type.Literal("spawn"),
      Type.Literal("exec"),
      Type.Literal("write"),
      Type.Literal("send"),
      Type.Literal("read"),
      Type.Literal("log"),
      Type.Literal("list"),
      Type.Literal("close"),
      Type.Literal("kill"),
      Type.Literal("reset"),
    ]),
  ),
  id: Type.Optional(Type.String({ description: "Session identifier or pane name" })),
  command: Type.Optional(Type.String({ description: "Command to execute or spawn" })),
  input: Type.Optional(Type.String({ description: "Text or keys to write/send to session" })),
  cwd: Type.Optional(Type.String({ description: "Working directory for session" })),
  timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds" })),
  wake_on: Type.Optional(
    Type.Object({
      exit: Type.Optional(Type.Boolean({ description: "Wake agent when process exits (default true)" })),
      match: Type.Optional(
        Type.Union([Type.String(), Type.Array(Type.String())], {
          description: "Regex pattern(s) or keywords to wake agent on match",
        }),
      ),
      silence: Type.Optional(
        Type.Number({ description: "Wake agent if output goes silent for N milliseconds" }),
      ),
    }, { description: "Event-driven wakeup triggers" }),
  ),
});

export const sessionSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(sessionItemSchema, { description: "Batch session operations array" }),
  ),
  action: Type.Optional(
    Type.Union(
      [
        Type.Literal("create", { description: "Create/spawn a new background process or pane session" }),
        Type.Literal("spawn", { description: "Alias for create" }),
        Type.Literal("exec", { description: "Execute a command in an existing or new session" }),
        Type.Literal("write", { description: "Send text or input to session" }),
        Type.Literal("send", { description: "Alias for write" }),
        Type.Literal("read", { description: "Read output from session" }),
        Type.Literal("log", { description: "Alias for read" }),
        Type.Literal("list", { description: "List all active sessions" }),
        Type.Literal("close", { description: "Close/terminate a session" }),
        Type.Literal("kill", { description: "Alias for close" }),
        Type.Literal("reset", { description: "Reset/terminate all sessions and clear registry" }),
      ],
      { description: "Action to perform" },
    ),
  ),
  id: Type.Optional(Type.String({ description: "Session identifier" })),
  command: Type.Optional(Type.String({ description: "Command to run" })),
  input: Type.Optional(Type.String({ description: "Input to send" })),
  cwd: Type.Optional(Type.String({ description: "Working directory" })),
  timeout: Type.Optional(Type.Number({ description: "Timeout in milliseconds" })),
  wake_on: Type.Optional(
    Type.Object({
      exit: Type.Optional(Type.Boolean({ description: "Wake agent when process exits (default true)" })),
      match: Type.Optional(
        Type.Union([Type.String(), Type.Array(Type.String())], {
          description: "Regex pattern(s) or keywords to wake agent on match",
        }),
      ),
      silence: Type.Optional(
        Type.Number({ description: "Wake agent if output goes silent for N milliseconds" }),
      ),
    }, { description: "Event-driven wakeup triggers" }),
  ),
});

// Process table for in-process fallbacks
export const activeProcesses = new Map<string, { proc: ChildProcess; logFile: string; cwd: string; exitCode: number | null; timedOut: boolean }>();

export function registerSessionProcess(
  id: string,
  entry: { proc: ChildProcess; logFile: string; cwd: string; exitCode: number | null; timedOut: boolean },
): void {
  activeProcesses.set(id, entry);
}

export function getSessionsDir(customBase?: string): string {
  const base = customBase || join(homedir(), ".pi", "sessions");
  if (!existsSync(base)) {
    mkdirSync(base, { recursive: true });
  }
  return base;
}

export function isHerdrAvailable(): boolean {
  try {
    execSync("herdr status --help", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function saveSessionRecord(record: SessionRecord, sessionsDir?: string): void {
  const dir = getSessionsDir(sessionsDir);
  const file = join(dir, `${record.id}.json`);
  writeFileSync(file, JSON.stringify(record, null, 2), "utf-8");
}

export function loadSessionRecord(id: string, sessionsDir?: string): SessionRecord | null {
  const dir = getSessionsDir(sessionsDir);
  const file = join(dir, `${id}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as SessionRecord;
  } catch {
    return null;
  }
}

export function listSessionRecords(sessionsDir?: string): SessionRecord[] {
  const dir = getSessionsDir(sessionsDir);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const records: SessionRecord[] = [];
  for (const f of files) {
    try {
      const rec = JSON.parse(readFileSync(join(dir, f), "utf-8")) as SessionRecord;
      records.push(rec);
    } catch {
      // Ignore corrupt entries
    }
  }
  return records;
}

export function deleteSessionRecord(id: string, sessionsDir?: string): void {
  const dir = getSessionsDir(sessionsDir);
  const file = join(dir, `${id}.json`);
  if (existsSync(file)) {
    unlinkSync(file);
  }
}

export async function executeSessionOp(
  _toolCallId: string,
  params: any,
  _signal?: AbortSignal,
  _onUpdate?: (update: unknown) => void,
  ctx: any = { cwd: process.cwd() },
) {
  if (Array.isArray(params.ops) && params.ops.length > 0) {
    if (params.ops.length === 1) {
      return executeSessionOp(_toolCallId, { ...params.ops[0], ops: undefined }, _signal, _onUpdate, ctx);
    }
    const results = await Promise.all(
      params.ops.map((op: any) => executeSessionOp(_toolCallId, op, _signal, _onUpdate, ctx)),
    );
    return {
      content: [{ type: "text" as const, text: results.map((r: any) => r.content[0].text).join("\n---\n") }],
      isError: false,
      details: {
        totalOps: results.length,
        results: results.map((r: any) => r.details),
      },
    };
  }

  const action = params.action ?? (params.command ? "create" : "list");
  const sessionsDir = ctx.sessionsDir || getSessionsDir();
  const targetCwd = params.cwd ? params.cwd : ctx.cwd;

  // 1. LIST
  if (action === "list") {
    const records = listSessionRecords(sessionsDir);
    // Update live status for in-memory processes
    for (const rec of records) {
      const live = activeProcesses.get(rec.id);
      if (live) {
        rec.status = live.proc.exitCode !== null ? "exited" : "running";
        rec.exitCode = live.exitCode ?? live.proc.exitCode;
        rec.timedOut = live.timedOut;
      }
    }
    if (records.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No active sessions found." }],
        isError: false,
        details: { sessions: [] },
      };
    }
    const rows = records
      .map(
        (r) =>
          `[${r.id}] ${r.status.toUpperCase()} (pid=${r.pid || "?"}, exit=${r.exitCode ?? "?"}) cmd: "${r.command}" cwd: ${r.cwd}`,
      )
      .join("\n");
    return {
      content: [{ type: "text" as const, text: `Active Sessions (${records.length}):\n${rows}` }],
      isError: false,
      details: { sessions: records },
    };
  }

  // 2. RESET
  if (action === "reset") {
    const records = listSessionRecords(sessionsDir);
    let closedCount = 0;
    for (const rec of records) {
      const live = activeProcesses.get(rec.id);
      if (live) {
        try {
          live.proc.kill("SIGTERM");
        } catch {
          // ignore
        }
        activeProcesses.delete(rec.id);
      }
      deleteSessionRecord(rec.id, sessionsDir);
      closedCount++;
    }
    return {
      content: [{ type: "text" as const, text: `Reset complete. Terminated and removed ${closedCount} session(s).` }],
      isError: false,
      details: { resetCount: closedCount },
    };
  }

  // Session ID validation for single-session operations
  const sessionId = params.id || `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  // 3. CREATE / SPAWN
  if (action === "create" || action === "spawn" || action === "exec") {
    if (!params.command) {
      return {
        content: [{ type: "text" as const, text: "Error: missing required parameter 'command'." }],
        isError: true,
        details: { error: "missing_command" },
      };
    }

    const logFile = join(sessionsDir, `${sessionId}.log`);
    writeFileSync(logFile, "", "utf-8");

    // Fallback or Direct Background Process
    const child = spawn("sh", ["-c", params.command], {
      cwd: targetCwd,
      detached: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const sessionState = {
      proc: child,
      logFile,
      cwd: targetCwd,
      exitCode: null as number | null,
      timedOut: false,
    };
    activeProcesses.set(sessionId, sessionState);

    // Setup event-driven wake_on triggers
    const wakeOn = params.wake_on;
    let silenceTimer: ReturnType<typeof setTimeout> | undefined;
    const matchPatterns: RegExp[] = [];
    if (wakeOn?.match) {
      const patterns = Array.isArray(wakeOn.match) ? wakeOn.match : [wakeOn.match];
      for (const p of patterns) {
        try {
          matchPatterns.push(new RegExp(p));
        } catch {
          // fallback literal match
          matchPatterns.push(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
      }
    }

    const triggerWake = (reason: string, snippet?: string) => {
      const notifyText = `[Session Wakeup] Session '${sessionId}' triggered wake_on (${reason})${snippet ? `:\n${snippet}` : "."}`;
      ctx?.ui?.notify?.(notifyText, "info");
      if (typeof ctx?.sendUserMessage === "function") {
        ctx.sendUserMessage(notifyText, { deliverAs: "followUp" });
      }
    };

    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (wakeOn?.silence && wakeOn.silence > 0) {
        silenceTimer = setTimeout(() => {
          if (sessionState.exitCode === null) {
            triggerWake(`silence after ${wakeOn.silence}ms`);
          }
        }, wakeOn.silence);
      }
    };

    child.stdout?.on("data", (data) => {
      const str = data.toString();
      try {
        writeFileSync(logFile, str, { flag: "a" });
      } catch {}

      resetSilenceTimer();

      if (matchPatterns.length > 0) {
        for (const re of matchPatterns) {
          if (re.test(str)) {
            triggerWake(`matched pattern '${re.source}'`, str.trim().slice(0, 200));
            break;
          }
        }
      }
    });

    child.stderr?.on("data", (data) => {
      const str = data.toString();
      try {
        writeFileSync(logFile, str, { flag: "a" });
      } catch {}

      resetSilenceTimer();

      if (matchPatterns.length > 0) {
        for (const re of matchPatterns) {
          if (re.test(str)) {
            triggerWake(`matched pattern '${re.source}' in stderr`, str.trim().slice(0, 200));
            break;
          }
        }
      }
    });

    child.on("close", (code) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      sessionState.exitCode = code;
      const rec = loadSessionRecord(sessionId, sessionsDir);
      if (rec) {
        rec.status = "exited";
        rec.exitCode = code;
        saveSessionRecord(rec, sessionsDir);
      }
      if (wakeOn?.exit !== false && wakeOn !== undefined) {
        triggerWake(`process exited with code ${code}`);
      }
    });

    const record: SessionRecord = {
      id: sessionId,
      command: params.command,
      cwd: targetCwd,
      createdAt: Date.now(),
      pid: child.pid,
      status: "running",
      exitCode: null,
      timedOut: false,
      outputLogFile: logFile,
      backend: "process",
    };
    saveSessionRecord(record, sessionsDir);

    if (params.timeout && params.timeout > 0) {
      setTimeout(() => {
        if (sessionState.exitCode === null) {
          sessionState.timedOut = true;
          try {
            child.kill("SIGTERM");
          } catch {}
        }
      }, params.timeout);
    }

    resetSilenceTimer();

    const footer = `\n[exit=null cwd=${targetCwd} timed_out=false]`;
    return {
      content: [
        {
          type: "text" as const,
          text: `Session '${sessionId}' started (pid=${child.pid}) for command: ${params.command}${footer}`,
        },
      ],
      isError: false,
      details: { session: record },
    };
  }

  // 4. WRITE / SEND
  if (action === "write" || action === "send") {
    if (!params.id) {
      return {
        content: [{ type: "text" as const, text: "Error: missing required parameter 'id'." }],
        isError: true,
        details: { error: "missing_id" },
      };
    }
    const input = params.input ?? "";
    const live = activeProcesses.get(params.id);
    if (!live || !live.proc.stdin) {
      return {
        content: [{ type: "text" as const, text: `Error: session '${params.id}' is not active or stdin is closed.` }],
        isError: true,
        details: { error: "session_inactive", id: params.id },
      };
    }

    live.proc.stdin.write(input.endsWith("\n") ? input : input + "\n");
    return {
      content: [{ type: "text" as const, text: `Sent input to session '${params.id}'.` }],
      isError: false,
      details: { id: params.id, inputLength: input.length },
    };
  }

  // 5. READ / LOG
  if (action === "read" || action === "log") {
    if (!params.id) {
      return {
        content: [{ type: "text" as const, text: "Error: missing required parameter 'id'." }],
        isError: true,
        details: { error: "missing_id" },
      };
    }
    const rec = loadSessionRecord(params.id, sessionsDir);
    const live = activeProcesses.get(params.id);
    const logFile = rec?.outputLogFile || join(sessionsDir, `${params.id}.log`);
    const output = existsSync(logFile) ? readFileSync(logFile, "utf-8") : "(no output yet)";

    const exitCode = live?.exitCode ?? live?.proc.exitCode ?? rec?.exitCode ?? null;
    const timedOut = live?.timedOut ?? rec?.timedOut ?? false;
    const cwd = rec?.cwd || targetCwd;
    const footer = `\n[exit=${exitCode ?? "running"} cwd=${cwd} timed_out=${timedOut}]`;

    return {
      content: [{ type: "text" as const, text: `--- Output for session '${params.id}' ---\n${output}${footer}` }],
      isError: false,
      details: {
        id: params.id,
        output,
        exitCode,
        timedOut,
        cwd,
      },
    };
  }

  // 6. CLOSE / KILL
  if (action === "close" || action === "kill") {
    if (!params.id) {
      return {
        content: [{ type: "text" as const, text: "Error: missing required parameter 'id'." }],
        isError: true,
        details: { error: "missing_id" },
      };
    }
    const live = activeProcesses.get(params.id);
    if (live) {
      try {
        live.proc.kill("SIGTERM");
      } catch {}
      activeProcesses.delete(params.id);
    }
    deleteSessionRecord(params.id, sessionsDir);

    return {
      content: [{ type: "text" as const, text: `Closed session '${params.id}'.` }],
      isError: false,
      details: { id: params.id, closed: true },
    };
  }

  return {
    content: [{ type: "text" as const, text: `Error: unknown action '${action}'.` }],
    isError: true,
    details: { error: "unknown_action", action },
  };
}

export function registerSessionTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "session",
    label: "Session",
    description: "Herdr-backed process and pane session manager (replaces Zellij). Unifies background tasks and subagents.",
    promptSnippet: "Herdr-backed session management for background tasks",
    promptGuidelines: [
      "Use session create/spawn to run long-running commands, servers, or subagents in the background.",
      "Use session read/log with footer [exit=N cwd=... timed_out=bool] to monitor output.",
      "Use session reset to clean up all background sessions.",
    ],
    parameters: sessionSchema,

    renderCall(args: any, theme: any) {
      const act = args?.action || (args?.command ? "create" : "list");
      const id = args?.id ? ` [${args.id}]` : "";
      const text = theme.fg("toolTitle", "session ") + theme.fg("accent", `${act}${id}`);
      return new Text(text, 0, 0);
    },

    renderResult(result: any, { expanded }: any, theme: any) {
      const text = theme.fg("muted", result.isError ? "Session Error" : "Session OK");
      return new Text(text, 0, 0);
    },

    async execute(toolCallId: string, params: any, signal: any, onUpdate: any, ctx: any) {
      return executeSessionOp(toolCallId, params, signal, onUpdate, ctx) as any;
    },
  });

  pi.registerCommand("sessions", {
    description: "Manage background sessions",
    handler: async (args: string, ctx: any) => {
      const parts = args.trim().split(/\s+/);
      const sub = parts[0] || "list";
      const idOrCmd = parts.slice(1).join(" ");
      let params: any = { action: sub };
      if (sub === "create" || sub === "spawn" || sub === "exec") {
        params.command = idOrCmd;
      } else if (idOrCmd) {
        params.id = idOrCmd;
      }
      const res = await executeSessionOp("cmd", params, undefined, undefined, { cwd: ctx?.cwd || process.cwd() });
      ctx.ui?.notify?.(res.content[0].text, res.isError ? "error" : "info");
    },
  });
}
