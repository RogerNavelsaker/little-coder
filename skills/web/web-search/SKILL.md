---
name: web-search
description: Searches the web from the terminal and returns compact, agent-readable results. Use when Codex needs web search results, source discovery, current public pages, or candidate URLs before fetching page content with web-fetch.
---

# Web Search

Use `ddgr` for lightweight web search from the shell. Prefer JSON output so results can be filtered before any page is fetched.

## Preferred Wrapper

Use the Nu wrapper for repeatable search output:

```bash
nu ./skills/web/web-search/scripts/search.nu "search terms"
```

The wrapper emits TOON by default for compact agent-readable results. Use `--format json` when another tool expects JSON, and `--output results.toon` to save the search results.

## Quick Search

Run searches in the shell:

```bash
ddgr --json --np -n 8 --colorize=never "search terms"
```

Use focused queries. Always preserve the returned `url` values as citations in the final answer.

```bash
ddgr --json --np -n 10 --site docs.example.com "configuration cache"
ddgr --json --np -n 5 --time m "project release notes"
ddgr --json --np -n 8 --reg us-en "company pricing"
```

## Workflow

1. Start with `ddgr --json --np -n 8 --colorize=never "<query>"`.
2. Inspect titles, URLs, and snippets; keep only sources that match the task.
3. Refine with `--site`, `--time d|w|m|y`, or additional query terms when results are broad.
4. Use `web-fetch` for selected URLs when the page contents are needed.
5. Cite or record the final source URLs in the response or notes. For direct files, route to `web-download` instead.

## Flags

- `--json`: return machine-readable results.
- `--np`: run once and exit without interactive prompt.
- `-n N`: fetch up to 25 results.
- `--site DOMAIN`: restrict results to one site.
- `--time d|w|m|y`: restrict by recent day, week, month, or year.
- `--reg REGION`: set a DuckDuckGo region such as `us-en`.
- `--colorize=never`: keep output parseable.
- Wrapper `--timeout N`: fail after N seconds instead of hanging.

## Boundaries

Use official or primary sources for technical, legal, medical, financial, or API behavior when available. For pages that require JavaScript rendering, login, cookies, or interaction, use `browser-cli` or `web-fetch` with browser/cookie options.
