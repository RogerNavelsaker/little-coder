import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { Defuddle } from "defuddle/node";
import process from "node:process";

type Engine = "defuddle" | "readability";

type SourceMetadata = {
  description: string;
  author: string;
  site: string;
  published: string;
};

type CleanupStats = {
  removedScripts: number;
  removedStyles: number;
  removedNoscripts: number;
  removedTemplates: number;
  removedMetadata: number;
  removedLinks: number;
  removedComments: number;
  sanitizedDataImages: number;
  sanitizedDataSources: number;
  replacedSvgs: number;
  insertedBase: number;
};

type InputPage = {
  url: string;
  title?: string;
  html: string;
  cleanup?: CleanupStats;
  sourceMetadata?: SourceMetadata;
};

type FlyscrapeRow = {
  url?: string;
  data?: InputPage;
};

type Link = {
  text: string;
  url: string;
};

type CleanedPage = InputPage & {
  cleanup: CleanupStats;
  sourceMetadata: SourceMetadata;
};

const emptyStats = (): CleanupStats => ({
  removedScripts: 0,
  removedStyles: 0,
  removedNoscripts: 0,
  removedTemplates: 0,
  removedMetadata: 0,
  removedLinks: 0,
  removedComments: 0,
  sanitizedDataImages: 0,
  sanitizedDataSources: 0,
  replacedSvgs: 0,
  insertedBase: 0,
});

const emptyMetadata = (): SourceMetadata => ({
  description: "",
  author: "",
  site: "",
  published: "",
});

function argValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function engineFromArgs(): Engine {
  const value = argValue("--engine", "defuddle");
  if (value === "defuddle" || value === "readability") {
    return value;
  }

  throw new Error(`unsupported engine: ${value}. Use defuddle or readability.`);
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function parseRows(input: string): InputPage[] {
  return input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FlyscrapeRow)
    .map((row) => row.data || (row as InputPage))
    .filter((page) => page.html);
}

function firstMetaContent(document: Document, selectors: string[]) {
  for (const selector of selectors) {
    const content = document.querySelector(selector)?.getAttribute("content")?.trim();
    if (content) {
      return content;
    }
  }

  return "";
}

function extractSourceMetadata(html: string, baseUrl: string): SourceMetadata {
  const dom = new JSDOM(html, { url: baseUrl });
  const { document } = dom.window;

  return {
    description: firstMetaContent(document, [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ]),
    author: firstMetaContent(document, [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="byl"]',
    ]),
    site: firstMetaContent(document, [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="twitter:site"]',
    ]),
    published: firstMetaContent(document, [
      'meta[property="article:published_time"]',
      'meta[name="date"]',
      'meta[name="pubdate"]',
      'meta[itemprop="datePublished"]',
    ]),
  };
}

function removeElements(document: Document, selector: string, stat: keyof CleanupStats, stats: CleanupStats) {
  for (const node of Array.from(document.querySelectorAll(selector))) {
    node.remove();
    stats[stat] += 1;
  }
}

function removeComments(document: Document, stats: CleanupStats) {
  const walker = document.createTreeWalker(document, document.defaultView?.NodeFilter.SHOW_COMMENT ?? 128);
  const comments: Comment[] = [];

  while (walker.nextNode()) {
    comments.push(walker.currentNode as Comment);
  }

  for (const comment of comments) {
    comment.remove();
    stats.removedComments += 1;
  }
}

function sanitizeDataUrls(document: Document, stats: CleanupStats) {
  for (const image of Array.from(document.querySelectorAll("img[src]"))) {
    const src = image.getAttribute("src") || "";
    if (src.startsWith("data:image/")) {
      image.setAttribute("src", "");
      image.setAttribute("data-removed-src", "inline-image");
      stats.sanitizedDataImages += 1;
    }
  }

  for (const node of Array.from(document.querySelectorAll("[srcset]"))) {
    const srcset = node.getAttribute("srcset") || "";
    if (srcset.includes("data:image/")) {
      node.removeAttribute("srcset");
      node.setAttribute("data-removed-srcset", "inline-image");
      stats.sanitizedDataSources += 1;
    }
  }
}

function replaceSvgs(document: Document, stats: CleanupStats) {
  for (const svg of Array.from(document.querySelectorAll("svg"))) {
    const label =
      svg.getAttribute("aria-label") ||
      svg.querySelector("title")?.textContent?.trim() ||
      svg.querySelector("desc")?.textContent?.trim() ||
      "SVG graphic removed";
    const replacement = document.createElement("span");

    replacement.setAttribute("data-removed-svg", "true");
    replacement.textContent = `[SVG: ${label.replace(/\s+/g, " ")}]`;
    svg.replaceWith(replacement);
    stats.replacedSvgs += 1;
  }
}

function insertBase(document: Document, baseUrl: string, stats: CleanupStats) {
  if (!document.querySelector("base[href]")) {
    const base = document.createElement("base");
    base.setAttribute("href", baseUrl);
    document.head.prepend(base);
    stats.insertedBase = 1;
  }
}

function cleanupHtml(html: string, baseUrl: string) {
  const dom = new JSDOM(html, { url: baseUrl });
  const { document } = dom.window;
  const stats = emptyStats();

  removeElements(document, "script", "removedScripts", stats);
  removeElements(document, "style", "removedStyles", stats);
  removeElements(document, "noscript", "removedNoscripts", stats);
  removeElements(document, "template", "removedTemplates", stats);
  removeElements(document, "meta", "removedMetadata", stats);
  removeElements(document, "link", "removedLinks", stats);
  removeComments(document, stats);
  sanitizeDataUrls(document, stats);
  replaceSvgs(document, stats);
  insertBase(document, baseUrl, stats);

  return {
    html: dom.serialize(),
    stats,
  };
}

function mergeMetadata(primary?: SourceMetadata, fallback?: SourceMetadata): SourceMetadata {
  return {
    description: primary?.description || fallback?.description || "",
    author: primary?.author || fallback?.author || "",
    site: primary?.site || fallback?.site || "",
    published: primary?.published || fallback?.published || "",
  };
}

function cleanPage(page: InputPage): CleanedPage {
  if (page.cleanup) {
    return {
      ...page,
      cleanup: page.cleanup,
      sourceMetadata: mergeMetadata(page.sourceMetadata, emptyMetadata()),
    };
  }

  const sourceMetadata = extractSourceMetadata(page.html, page.url);
  const cleaned = cleanupHtml(page.html, page.url);

  return {
    ...page,
    html: cleaned.html,
    cleanup: cleaned.stats,
    sourceMetadata,
  };
}

function extractLinks(html: string, baseUrl: string): Link[] {
  const dom = new JSDOM(html, { url: baseUrl });
  return Array.from(dom.window.document.querySelectorAll("a[href]"))
    .map((anchor) => {
      const href = anchor.getAttribute("href") || "";

      if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
        return null;
      }

      return {
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
        url: new URL(href, baseUrl).toString(),
      };
    })
    .filter((link): link is Link => Boolean(link?.url));
}

async function extractWithDefuddle(page: CleanedPage) {
  const result = await Defuddle(page.html, page.url, {
    markdown: true,
  });

  return {
    url: page.url,
    title: result.title || page.title || "",
    description: result.description || page.sourceMetadata.description,
    author: result.author || page.sourceMetadata.author,
    site: result.site || page.sourceMetadata.site,
    published: result.published || page.sourceMetadata.published,
    wordCount: result.wordCount || 0,
    extraction: "flyscrape-cleanup-defuddle",
    cleanup: page.cleanup,
    markdown: String(result.content || "").trim(),
    html: (result as { contentHtml?: string }).contentHtml || "",
    links: extractLinks(page.html, page.url),
  };
}

function extractWithReadability(page: CleanedPage) {
  const dom = new JSDOM(page.html, {
    url: page.url,
  });
  const article = new Readability(dom.window.document).parse();
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const content = article?.content || "";
  const markdown = content ? turndown.turndown(content).trim() : "";

  return {
    url: page.url,
    title: article?.title || page.title || "",
    description: article?.excerpt || page.sourceMetadata.description,
    author: article?.byline || page.sourceMetadata.author,
    site: article?.siteName || page.sourceMetadata.site,
    published: page.sourceMetadata.published,
    wordCount: article?.textContent ? article.textContent.split(/\s+/).filter(Boolean).length : 0,
    extraction: "flyscrape-cleanup-readability",
    cleanup: page.cleanup,
    markdown,
    html: content,
    links: extractLinks(page.html, page.url),
  };
}

async function main() {
  const engine = engineFromArgs();
  const input = await readStdin();
  const pages = parseRows(input).map(cleanPage);

  for (const page of pages) {
    const output = engine === "readability" ? extractWithReadability(page) : await extractWithDefuddle(page);
    console.log(JSON.stringify(output));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
