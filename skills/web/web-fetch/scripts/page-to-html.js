export const config = {
  url: "https://example.com/",
  output: {
    format: "ndjson",
  },
};

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function firstMeta(doc, selectors) {
  for (const selector of selectors) {
    const content = text(doc.find(selector).first().attr("content"));
    if (content) {
      return content;
    }
  }

  return "";
}

function metadataFromDoc(doc) {
  return {
    description: firstMeta(doc, [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ]),
    author: firstMeta(doc, [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="byl"]',
    ]),
    site: firstMeta(doc, [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="twitter:site"]',
    ]),
    published: firstMeta(doc, [
      'meta[property="article:published_time"]',
      'meta[name="date"]',
      'meta[name="pubdate"]',
      'meta[itemprop="datePublished"]',
    ]),
  };
}

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function svgLabel(svg) {
  const aria = svg.match(/\saria-label=(["'])(.*?)\1/i)?.[2];
  const title = svg.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const desc = svg.match(/<desc[^>]*>([\s\S]*?)<\/desc>/i)?.[1];

  return text(aria || title || desc || "SVG graphic removed");
}

function normalizeHtmlShell(html) {
  if (html.startsWith("<!doctype") || html.startsWith("<html")) {
    return html;
  }

  return `<!doctype html><html>${html}</html>`;
}

function removeElementHtml(html, tag) {
  const pattern = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi");

  return {
    html: html.replace(pattern, ""),
    count: countMatches(html, pattern),
  };
}

function removeVoidElementHtml(html, tag) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>`, "gi");

  return {
    html: html.replace(pattern, ""),
    count: countMatches(html, pattern),
  };
}

function insertBaseHtml(html, url) {
  if (/<base\b[^>]*\shref=/i.test(html)) {
    return {
      html,
      inserted: 0,
    };
  }

  if (/<head\b[^>]*>/i.test(html)) {
    return {
      html: html.replace(/<head\b([^>]*)>/i, `<head$1><base href="${url}">`),
      inserted: 1,
    };
  }

  return {
    html: html.replace(/<html\b([^>]*)>/i, `<html$1><head><base href="${url}"></head>`),
    inserted: 1,
  };
}

function cleanupHtml(doc, url) {
  const sourceMetadata = metadataFromDoc(doc);
  let html = normalizeHtmlShell(doc.find("html").first().html() || doc.find("body").first().html() || "");
  const cleanup = {
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
  };

  for (const [tag, stat] of [
    ["script", "removedScripts"],
    ["style", "removedStyles"],
    ["noscript", "removedNoscripts"],
    ["template", "removedTemplates"],
  ]) {
    const removed = removeElementHtml(html, tag);
    html = removed.html;
    cleanup[stat] = removed.count;
  }

  for (const [tag, stat] of [
    ["meta", "removedMetadata"],
    ["link", "removedLinks"],
  ]) {
    const removed = removeVoidElementHtml(html, tag);
    html = removed.html;
    cleanup[stat] = removed.count;
  }

  cleanup.removedComments = countMatches(html, /<!--[\s\S]*?-->/g);
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  cleanup.sanitizedDataImages = countMatches(html, /\ssrc=(["'])data:image\/[^"']*\1/gi);
  html = html.replace(/\ssrc=(["'])data:image\/[^"']*\1/gi, ' src="" data-removed-src="inline-image"');

  cleanup.sanitizedDataSources = countMatches(html, /\ssrcset=(["'])[^"']*data:image\/[^"']*\1/gi);
  html = html.replace(/\ssrcset=(["'])[^"']*data:image\/[^"']*\1/gi, ' data-removed-srcset="inline-image"');

  cleanup.replacedSvgs = countMatches(html, /<svg\b[\s\S]*?<\/svg>/gi);
  html = html.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svg) => {
    return `<span data-removed-svg="true">[SVG: ${svgLabel(svg)}]</span>`;
  });

  const base = insertBaseHtml(html, url);
  html = base.html;
  cleanup.insertedBase = base.inserted;

  return {
    html,
    cleanup,
    sourceMetadata,
  };
}

export default function ({ doc, url }) {
  const title = text(doc.find("title").first().text() || doc.find("h1").first().text());
  const cleaned = cleanupHtml(doc, url);

  return {
    url,
    title,
    html: cleaned.html,
    cleanup: cleaned.cleanup,
    sourceMetadata: cleaned.sourceMetadata,
  };
}
