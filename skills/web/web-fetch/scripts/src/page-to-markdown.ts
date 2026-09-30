import Defuddle from "defuddle";

export const config = {
  url: "https://example.com/",
  output: {
    format: "ndjson",
  },
};

type FlyscrapeElement = {
  text(): string;
  attr(name: string): string;
};

type FlyscrapeDoc = {
  find(selector: string): {
    first(): FlyscrapeElement;
  };
};

type FlyscrapeContext = {
  doc: FlyscrapeDoc;
  url: string;
};

function clean(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackTitle(doc: FlyscrapeDoc): string {
  return clean(doc.find("title").first().text() || doc.find("h1").first().text());
}

export default function ({ doc, url }: FlyscrapeContext) {
  const title = fallbackTitle(doc);

  if (typeof document === "undefined") {
    return {
      url,
      title,
      extraction: "defuddle-core-unavailable",
      reason: "Flyscrape exposes a query wrapper as doc, not a browser DOM Document.",
    };
  }

  const result = new Defuddle(document, { url }).parse();
  return {
    url,
    title: result.title || title,
    description: result.description || "",
    author: result.author || "",
    site: result.site || "",
    published: result.published || "",
    wordCount: result.wordCount || 0,
    extraction: "defuddle-core",
    content: result.content,
    markdown: result.content,
  };
}
