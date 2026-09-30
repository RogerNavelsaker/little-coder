---
name: web-download
description: Downloads public files and media from the web. Use when the user needs a PDF, image, archive, document, or audio/video file saved locally rather than webpage text extraction.
---

Use `curl` first for direct files and `yt-dlp` for supported media pages. Use `aria2c` for large or resumable downloads. After downloading a PDF or office document, route extraction to `docling`. Crawl4AI is a webpage crawler and is not a replacement for binary downloading. Save downloads explicitly and verify the resulting file.

## Direct files

```bash
curl --fail --location --retry 2 --connect-timeout 10 --max-time 120 \
  --output /home/rona/Downloads/file.pdf \
  "https://example.com/file.pdf"
file /home/rona/Downloads/file.pdf
```

Use `--remote-header-name` only when the server-controlled filename is trusted. Prefer an explicit output path for reproducibility.

## Media pages

When installed, use `yt-dlp` for video/audio pages:

```bash
yt-dlp --no-playlist --output '/home/rona/Downloads/%(title)s.%(ext)s' \
  "https://example.com/video"
```

Check availability first with `command -v yt-dlp`; install it in the active project environment when it is missing. Use `web-fetch` when the requested result is page text, metadata, or links.

## Validation

- Confirm the command exits successfully.
- Confirm the file exists and is non-empty.
- Run `file` and inspect the reported type.
- Preserve the final local path in the response.
- Cite the source URL.

Respect access rights, robots policies, licensing, and site terms. Use browser tooling for authenticated or interaction-dependent downloads.
