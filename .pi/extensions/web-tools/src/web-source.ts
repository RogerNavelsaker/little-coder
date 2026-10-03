/**
 * `web_source` tool — Multi-forge code search, raw file retrieval, and downloading.
 *
 * Backends & Self-Hosted Fallbacks:
 * 1. Self-hosted Hound (`HOUND_URL`): `/api/v1/search?q=...`
 * 2. Self-hosted / Cloud GitLab (`GITLAB_URL` or `glab` CLI): `/api/v4/search?scope=blobs&search=...`
 * 3. Self-hosted Gitea / Forgejo (`GITEA_URL` or `TEA_URL`): `/api/v1/repos/search` / raw file endpoints
 * 4. GitHub (`gh` CLI or `raw.githubusercontent.com`): `gh search code` / raw file via curl
 * 5. Media & Asset Downloader: `aria2c`, `yt-dlp`, or `curl`
 */

import { Type } from "@sinclair/typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { spawnSync } from "node:child_process";
import { encodeToon } from "../../_shared/toon.ts";
import { storeWebArtifact } from "./storage.ts";

export interface CodeMatch {
  repository: string;
  path: string;
  lineMatches?: Array<{ line: string; lineNumber: number }>;
}

export const webSourceItemSchema = Type.Object({
  op: Type.Optional(
    Type.Union([
      Type.Literal("search", { description: "Search code across Hound, GitLab, Gitea, or GitHub" }),
      Type.Literal("file", { description: "Fetch raw file content from forge or repository" }),
      Type.Literal("download", { description: "Download media or file via yt-dlp, aria2c, or curl" }),
    ]),
  ),
  forge: Type.Optional(
    Type.Union([
      Type.Literal("hound", { description: "Self-hosted Hound code search engine" }),
      Type.Literal("gitlab", { description: "GitLab (self-hosted or gitlab.com)" }),
      Type.Literal("gitea", { description: "Gitea / Forgejo instance" }),
      Type.Literal("github", { description: "GitHub" }),
    ]),
  ),
  query: Type.Optional(Type.String({ description: "Search query or regex pattern" })),
  url: Type.Optional(Type.String({ description: "Target URL to download or retrieve" })),
  repo: Type.Optional(Type.String({ description: "Repository identifier (owner/repo or project ID)" })),
  path: Type.Optional(Type.String({ description: "File path in repository or local save path" })),
  ref: Type.Optional(Type.String({ description: "Branch, tag, or commit hash (default: main/HEAD)" })),
  limit: Type.Optional(Type.Number({ description: "Max results limit (default: 10)" })),
  endpoint: Type.Optional(Type.String({ description: "Custom forge or search instance endpoint" })),
  token: Type.Optional(Type.String({ description: "Forge access token (or via env vars)" })),
  downloader: Type.Optional(
    Type.Union([
      Type.Literal("xh"),
      Type.Literal("yt-dlp"),
      Type.Literal("aria2c"),
      Type.Literal("curl"),
    ]),
  ),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

export const webSourceSchema = Type.Object({
  ops: Type.Optional(
    Type.Array(webSourceItemSchema, { description: "Batch web source operations" }),
  ),
  op: Type.Optional(
    Type.Union([
      Type.Literal("search"),
      Type.Literal("file"),
      Type.Literal("download"),
    ]),
  ),
  forge: Type.Optional(
    Type.Union([
      Type.Literal("hound"),
      Type.Literal("gitlab"),
      Type.Literal("gitea"),
      Type.Literal("github"),
    ]),
  ),
  query: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),
  repo: Type.Optional(Type.String()),
  path: Type.Optional(Type.String()),
  ref: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
  endpoint: Type.Optional(Type.String()),
  token: Type.Optional(Type.String()),
  downloader: Type.Optional(
    Type.Union([
      Type.Literal("xh"),
      Type.Literal("yt-dlp"),
      Type.Literal("aria2c"),
      Type.Literal("curl"),
    ]),
  ),
  target: Type.Optional(Type.Union([Type.Literal("repo"), Type.Literal("user")])),
});

/** Search code via self-hosted Hound instance */
function searchHound(endpoint: string, query: string, limit: number): CodeMatch[] {
  try {
    const url = new URL("/api/v1/search", endpoint);
    url.searchParams.set("q", query);
    const proc = spawnSync("curl", ["-sSL", "--max-time", "15", url.toString()], { encoding: "utf-8" });
    if (proc.status === 0 && proc.stdout) {
      const data = JSON.parse(proc.stdout);
      const matches: CodeMatch[] = [];
      const results = data.results || {};
      for (const [repoName, repoData] of Object.entries<any>(results)) {
        if (!repoData || !Array.isArray(repoData.Matches)) continue;
        for (const m of repoData.Matches) {
          matches.push({
            repository: repoName,
            path: m.Filename || "",
            lineMatches: (m.Matches || []).map((match: any) => ({
              line: match.Line || "",
              lineNumber: match.LineNumber || 0,
            })),
          });
          if (matches.length >= limit) return matches;
        }
      }
      return matches;
    }
  } catch {}
  return [];
}

/** Search code via GitLab (self-hosted or gitlab.com) */
function searchGitLab(endpoint: string, query: string, token: string, limit: number): CodeMatch[] {
  try {
    const url = new URL("/api/v4/search", endpoint);
    url.searchParams.set("scope", "blobs");
    url.searchParams.set("search", query);
    url.searchParams.set("per_page", String(limit));

    const headers = ["-H", "Accept: application/json"];
    if (token) headers.push("-H", `PRIVATE-TOKEN: ${token}`);

    const proc = spawnSync("curl", ["-sSL", "--max-time", "15", ...headers, url.toString()], { encoding: "utf-8" });
    if (proc.status === 0 && proc.stdout) {
      const data = JSON.parse(proc.stdout);
      if (Array.isArray(data)) {
        return data.slice(0, limit).map((item: any) => ({
          repository: String(item.project_id || item.project_name || ""),
          path: item.path || item.filename || "",
          lineMatches: item.data ? [{ line: item.data, lineNumber: item.startline || 1 }] : undefined,
        }));
      }
    }
  } catch {}
  return [];
}

/** Search code via Gitea / Forgejo */
function searchGitea(endpoint: string, query: string, token: string, limit: number): CodeMatch[] {
  try {
    const url = new URL("/api/v1/repos/search", endpoint);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));

    const headers = ["-H", "Accept: application/json"];
    if (token) headers.push("-H", `Authorization: token ${token}`);

    const proc = spawnSync("curl", ["-sSL", "--max-time", "15", ...headers, url.toString()], { encoding: "utf-8" });
    if (proc.status === 0 && proc.stdout) {
      const data = JSON.parse(proc.stdout);
      const repos = data.data || (Array.isArray(data) ? data : []);
      return repos.slice(0, limit).map((r: any) => ({
        repository: r.full_name || r.name || "",
        path: r.description || "repository match",
      }));
    }
  } catch {}
  return [];
}

/** Search code via GitHub CLI (`gh search code`) */
function searchGitHub(query: string, repo: string | undefined, limit: number): CodeMatch[] {
  const args = ["search", "code", query, "--limit", String(limit), "--json", "repository,path"];
  if (repo) {
    args.push("--repo", repo.replace(/^github\.com\//, ""));
  }

  try {
    const proc = spawnSync("gh", args, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, timeout: 3000 });
    if (proc.status === 0 && proc.stdout) {
      const parsed = JSON.parse(proc.stdout);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, limit).map((item: any) => ({
          repository: item.repository?.nameWithOwner || item.repository?.fullName || item.repository?.name || "",
          path: item.path || "",
        }));
      }
    }
  } catch {}
  return [];
}

export function executeWebSourceOp(op: any, cwd?: string): {
  success: boolean;
  op: string;
  output: string;
  matches?: CodeMatch[];
  artifactPath?: string;
  error?: string;
} {
  const operation =
    op.op ||
    (op.url ? "download" : op.path && op.repo ? "file" : "search");

  // 1. Download operation (aria2c / yt-dlp / curl)
  if (operation === "download") {
    const url = op.url;
    if (!url) {
      return { success: false, op: "download", output: "Missing URL", error: "Missing URL" };
    }

    const downloader = op.downloader || (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com") ? "yt-dlp" : "aria2c");

    // xh (Rust HTTP client)
    if (downloader === "xh") {
      const outPath = op.path ? ["-o", op.path] : ["-d"];
      const proc = spawnSync("xh", ["-b", ...outPath, url], {
        cwd,
        encoding: "utf-8",
      });

      if (proc.status === 0) {
        return {
          success: true,
          op: "download",
          output: `Downloaded with xh: ${url}`,
        };
      }
    }

    // yt-dlp
    if (downloader === "yt-dlp") {
      const proc = spawnSync("yt-dlp", ["--no-playlist", "--no-warnings", url], {
        cwd,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });

      if (proc.status === 0) {
        return {
          success: true,
          op: "download",
          output: proc.stdout.trim() || `Downloaded with yt-dlp: ${url}`,
        };
      }
    }

    // aria2c
    if (downloader === "aria2c") {
      const outPath = op.path ? ["-o", op.path] : [];
      const proc = spawnSync("aria2c", ["-x", "4", "-s", "4", "--summary-interval=0", ...outPath, url], {
        cwd,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });

      if (proc.status === 0) {
        return {
          success: true,
          op: "download",
          output: `Downloaded with aria2c: ${url}`,
        };
      }
    }

    // curl fallback
    const curlOut = op.path ? ["-o", op.path] : ["-O"];
    const proc = spawnSync("curl", ["-sSL", "--fail", ...curlOut, url], {
      cwd,
      encoding: "utf-8",
    });

    if (proc.status === 0) {
      return {
        success: true,
        op: "download",
        output: `Downloaded with curl: ${url}`,
      };
    }

    return {
      success: false,
      op: "download",
      output: proc.stderr || "Download failed across yt-dlp, aria2c, and curl",
      error: proc.stderr,
    };
  }

  // 2. File retrieval operation (GitLab / Gitea / GitHub raw)
  if (operation === "file") {
    if (!op.repo || !op.path) {
      return { success: false, op: "file", output: "repo and path required", error: "Missing repo or path" };
    }

    const ref = op.ref || "main";
    const cleanRepo = op.repo.replace(/^https?:\/\/[^/]+\//, "").replace(/^\/+/, "");

    // Gitea / Forgejo raw
    const giteaUrl = op.endpoint || process.env.GITEA_URL || process.env.TEA_URL;
    if (giteaUrl && (op.forge === "gitea" || (!op.forge && !cleanRepo.includes("github.com")))) {
      const rawUrl = `${giteaUrl.replace(/\/+$/, "")}/${cleanRepo}/raw/branch/${ref}/${op.path.replace(/^\/+/, "")}`;
      const token = op.token || process.env.GITEA_TOKEN || process.env.TEA_TOKEN || "";
      const headers = token ? ["-H", `Authorization: token ${token}`] : [];
      const proc = spawnSync("curl", ["-sSL", "--fail", "--max-time", "15", ...headers, rawUrl], {
        encoding: "utf-8",
      });
      if (proc.status === 0 && proc.stdout) {
        const stored = storeWebArtifact(proc.stdout, `file-${op.path.split("/").pop()}`, "txt", {
          target: op.target || "repo",
          cwd,
        });
        return {
          success: true,
          op: "file",
          output: stored.inline ? stored.content : `File saved: ${stored.filePath}`,
          artifactPath: stored.filePath,
        };
      }
    }

    // GitLab raw
    const gitlabUrl = op.endpoint || process.env.GITLAB_URL;
    if (gitlabUrl && (op.forge === "gitlab" || (!op.forge && gitlabUrl))) {
      const encodedRepo = encodeURIComponent(cleanRepo);
      const encodedPath = encodeURIComponent(op.path.replace(/^\/+/, ""));
      const rawUrl = `${gitlabUrl.replace(/\/+$/, "")}/api/v4/projects/${encodedRepo}/repository/files/${encodedPath}/raw?ref=${ref}`;
      const token = op.token || process.env.GITLAB_TOKEN || "";
      const headers = token ? ["-H", `PRIVATE-TOKEN: ${token}`] : [];
      const proc = spawnSync("curl", ["-sSL", "--fail", "--max-time", "15", ...headers, rawUrl], {
        encoding: "utf-8",
      });
      if (proc.status === 0 && proc.stdout) {
        const stored = storeWebArtifact(proc.stdout, `file-${op.path.split("/").pop()}`, "txt", {
          target: op.target || "repo",
          cwd,
        });
        return {
          success: true,
          op: "file",
          output: stored.inline ? stored.content : `File saved: ${stored.filePath}`,
          artifactPath: stored.filePath,
        };
      }
    }

    // GitHub raw fallback via curl
    const rawGhUrl = `https://raw.githubusercontent.com/${cleanRepo.replace(/^github\.com\//, "")}/${ref}/${op.path.replace(/^\/+/, "")}`;
    const ghProc = spawnSync("curl", ["-sSL", "--fail", "--max-time", "15", rawGhUrl], {
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
    });

    if (ghProc.status === 0 && ghProc.stdout) {
      const stored = storeWebArtifact(ghProc.stdout, `file-${op.path.split("/").pop()}`, "txt", {
        target: op.target || "repo",
        cwd,
      });

      return {
        success: true,
        op: "file",
        output: stored.inline ? stored.content : `File saved: ${stored.filePath}`,
        artifactPath: stored.filePath,
      };
    }

    return {
      success: false,
      op: "file",
      output: ghProc.stderr || "Failed to retrieve raw file across forges",
      error: ghProc.stderr,
    };
  }

  // 3. Search operation (Hound > GitLab > Gitea > GitHub)
  const query = op.query || (op.repo ? `repo:${op.repo}` : "");
  if (!query) {
    return { success: false, op: "search", output: "query is required for code search", error: "Missing query" };
  }

  const limit = typeof op.limit === "number" ? op.limit : 10;
  let matches: CodeMatch[] = [];

  // A. Self-hosted Hound if configured
  const houndEndpoint = op.endpoint || process.env.HOUND_URL;
  if (houndEndpoint && (op.forge === "hound" || !op.forge)) {
    matches = searchHound(houndEndpoint, query, limit);
  }

  // B. GitLab if configured
  if (matches.length === 0) {
    const gitlabEndpoint = op.endpoint || process.env.GITLAB_URL;
    if (gitlabEndpoint && (op.forge === "gitlab" || !op.forge)) {
      const gitlabToken = op.token || process.env.GITLAB_TOKEN || "";
      matches = searchGitLab(gitlabEndpoint, query, gitlabToken, limit);
    }
  }

  // C. Gitea if configured
  if (matches.length === 0) {
    const giteaEndpoint = op.endpoint || process.env.GITEA_URL || process.env.TEA_URL;
    if (giteaEndpoint && (op.forge === "gitea" || !op.forge)) {
      const giteaToken = op.token || process.env.GITEA_TOKEN || process.env.TEA_TOKEN || "";
      matches = searchGitea(giteaEndpoint, query, giteaToken, limit);
    }
  }

  // D. GitHub CLI fallback
  if (matches.length === 0) {
    matches = searchGitHub(query, op.repo, limit);
  }

  const toon = encodeToon({ query, count: matches.length, matches: matches.slice(0, limit) }).text;
  const stored = storeWebArtifact(toon, `code-search-${query.slice(0, 30)}`, "toon", {
    target: op.target || "repo",
    cwd,
  });

  return {
    success: true,
    op: "search",
    matches: matches.slice(0, limit),
    output: stored.inline ? stored.content : `Search results saved: ${stored.filePath}`,
    artifactPath: stored.filePath,
  };
}

export function registerWebSourceTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "web_source",
    label: "web_source",
    description: "Multi-forge code search, raw file retrieval, and downloading across Hound, GitLab, Gitea, GitHub, aria2c, and yt-dlp.",
    parameters: webSourceSchema,
    execute: async (_toolCallId: string, params: any) => {
      const ops = params?.ops || [params];
      const detailsList: any[] = [];
      const contentList: string[] = [];

      for (const op of ops) {
        const res = executeWebSourceOp(op);
        detailsList.push(res);
        contentList.push(res.output);
      }

      return {
        content: [{ type: "text", text: contentList.join("\n\n---\n\n") }],
        details: { ops: detailsList },
      };
    },
    renderResult: (result: any, { expanded }: { expanded: boolean }, theme: any) => {
      const details = result?.details?.ops || [];
      const first = details[0] || {};
      const count = first.matches?.length || 0;

      if (!expanded) {
        const text = theme?.fg ? theme.fg("accent", `📦 Source Search (${count} matches)`) : `📦 Source Search (${count} matches)`;
        return new Text(text, 0, 0);
      }

      const lines = [`📦 Source search matches: ${count}`];
      for (const m of (first.matches || []).slice(0, 5)) {
        lines.push(`• [${m.repository}] ${m.path}`);
      }
      const text = theme?.fg ? theme.fg("muted", lines.join("\n")) : lines.join("\n");
      return new Text(text, 0, 0);
    },
  });
}
