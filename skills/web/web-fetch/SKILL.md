---
name: web-fetch
description: Fetches, crawls, renders, and exports web content into Markdown, JSON, or TOON. Use when Codex needs website content without spending context on raw HTML/CSS/JS; multi-page crawls; link or metadata extraction; article Markdown; rendered pages; or pages discovered with web-search.
---

Use Docling for PDFs and office documents, `flyscrape` + Bun (Defuddle/Readability) as the primary webpage extractor, and Crawl4AI for remote/rendered multi-page crawls when `CRAWL4AI_URL` is set (default: none). The wrapper supports single pages, multi-URL fetches, small crawls, rendered pages, cleanup before extraction, and multiple output surfaces.

## Preferred Wrapper

```bash
nu ./skills/web/web-fetch/scripts/bin/fetch.nu "https://example.com/"
```

Defaults: Defuddle engine, Markdown extraction, Markdown file output in `/home/rona/Downloads`.

Pass multiple URLs positionally. Use TOON for compact multi-record output:

```bash
nu ./skills/web/web-fetch/scripts/bin/fetch.nu \
  "https://example.com/" \
  "https://www.iana.org/domains/example" \
  --format toon \
  --output /home/rona/Downloads/web-fetch-multi.toon
```

## Extraction Points

Use `--extract` to choose the output surface:

- `markdown`: extracted Markdown with URL/title metadata.
- `html`: extracted article HTML.
- `metadata`: URL, title, description, author, site, published date, word count, engine, and cleanup counters.
- `links`: page links with text and absolute URLs.
- `all`: full extraction record.

Use `--format` to choose the saved representation:

- `--format markdown`: plain Markdown when `--extract markdown`; JSON for other extraction points.
- `--format json`: structured JSON.
- `--format toon`: compact structured output through `tru`.

## Engines

- `--engine defuddle`: default; best general article extraction and Markdown output.
- `--engine readability`: Mozilla Readability plus Turndown; useful alternate extractor when Defuddle is too aggressive or preserves the wrong structure.

## Pipeline

1. `page-to-html.js` runs inside Flyscrape and emits cleaned NDJSON with `{url,title,html,cleanup,sourceMetadata}`.
2. `extract-cli.js` reads that NDJSON on stdin with Bun.
3. The CLI runs Defuddle or Readability/Turndown against the cleaned Flyscrape HTML.
4. If the CLI receives raw NDJSON from another source, it applies the same cleanup as a fallback.
5. `fetch.nu` writes Markdown, JSON, or TOON.

## Cleanup Pass

The cleanup pass runs in Flyscrape's `page-to-html.js` before the extraction engine sees the page. It is meant to reduce extractor noise before article parsing:

- Removes `script`, `style`, `noscript`, `template`, `meta`, `link`, and HTML comments.
- Sanitizes inline base64 image URLs in `src` and `srcset`.
- Replaces inline SVG bodies with compact text placeholders from `aria-label`, `title`, or `desc`.
- Inserts a `base` element so relative URLs resolve consistently.
- Preserves common source metadata from the original HTML before removing `meta` tags.
- Adds a `cleanup` stats object to metadata and full records.

This cleanup is not a replacement for Flyscrape. Flyscrape still owns fetching, rendering, crawling, browser mode, and page discovery.

## Build

Build the extraction CLI when source or dependencies change:

```bash
cd ./skills/web/web-fetch/scripts
bun run build:cli
```

Run the TypeScript check before rebuilding when editing the extractor:

```bash
cd ./skills/web/web-fetch/scripts
bun run check
```

## Common Commands

Markdown article:

```bash
nu ./skills/web/web-fetch/scripts/bin/fetch.nu "https://example.com/" --output /home/rona/Downloads/page.md
```

Readability alternate:

```bash
nu ./skills/web/web-fetch/scripts/bin/fetch.nu "https://example.com/" --engine readability --output /home/rona/Downloads/page-readability.md
```

Links as TOON:

```bash
nu ./skills/web/web-fetch/scripts/bin/fetch.nu "https://example.com/" --extract links --format toon --output /home/rona/Downloads/page-links.toon
```

Metadata as TOON:

```bash
nu ./skills/web/web-fetch/scripts/bin/fetch.nu "https://example.com/" --extract metadata --format toon --output /home/rona/Downloads/page-meta.toon
```

Small crawl:

```bash
nu ./skills/web/web-fetch/scripts/bin/fetch.nu "https://example.com/docs/" --depth 2 --follow "a[href]" --allowed-domain example.com --format toon --extract all --output /home/rona/Downloads/docs.toon
```

## Media Companion

`yt-dlp` is the right companion for video/audio pages: metadata, captions, transcripts, thumbnails, and downloadable media. Crawl4AI is for webpage crawling, not binary downloads. Use `web-download` with `curl` first and `yt-dlp` where appropriate.

## Boundaries

Use polite crawl settings: limit `--depth`, keep `--allowed-domain` narrow, and add Flyscrape rate/concurrency flags manually for large sites until the wrapper exposes them. Use cookies or browser mode only when the user has access rights and the task needs authenticated content. Route document conversion to `docling`; for direct file or media downloads, use `web-download`; always report the source URL and saved path.

The wrapper supports `--timeout N` per attempt and `--retries N` additional attempts. It fails loudly when retrieval produces no output.
