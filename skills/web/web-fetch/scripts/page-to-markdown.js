export const config = {
  url: "https://example.com/",
  output: {
    format: "ndjson",
  },
};

function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeMarkdown(value) {
  return clean(value).replace(/([\\`*_{}\[\]()#+.!|-])/g, "\\$1");
}

function listText(doc, selector) {
  return doc.find(selector)
    .map((el) => clean(el.text()))
    .filter((text) => text.length > 0);
}

function meta(doc, name) {
  const byName = doc.find(`meta[name="${name}"]`).first().attr("content");
  const byProperty = doc.find(`meta[property="${name}"]`).first().attr("content");
  return clean(byName || byProperty);
}

function pageTitle(doc) {
  return clean(
    doc.find("title").first().text() ||
    doc.find("h1").first().text() ||
    meta(doc, "og:title")
  );
}

function mainText(doc) {
  const selectors = [
    "main",
    "article",
    "[role=main]",
    ".content",
    "#content",
    "body",
  ];

  for (const selector of selectors) {
    const text = clean(doc.find(selector).first().text());
    if (text.length > 200) {
      return text;
    }
  }

  return clean(doc.find("body").text());
}

function links(doc, absoluteURL) {
  return doc.find("a[href]")
    .map((el) => {
      const text = clean(el.text());
      const href = clean(el.attr("href"));
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
        return null;
      }
      return {
        text,
        url: absoluteURL(href),
      };
    })
    .filter((link) => link && link.url);
}

export default function ({ doc, url, absoluteURL }) {
  const title = pageTitle(doc);
  const description = meta(doc, "description") || meta(doc, "og:description");
  const headings = [
    ...listText(doc, "h1").map((text) => ({ level: 1, text })),
    ...listText(doc, "h2").map((text) => ({ level: 2, text })),
    ...listText(doc, "h3").map((text) => ({ level: 3, text })),
  ];
  const linkList = links(doc, absoluteURL).slice(0, 100);

  const lines = [
    title ? `# ${escapeMarkdown(title)}` : "# Untitled page",
    "",
    `Source: ${url}`,
  ];

  if (description) {
    lines.push("", `> ${escapeMarkdown(description)}`);
  }

  if (headings.length > 0) {
    lines.push("", "## Page headings");
    headings.slice(0, 80).forEach((heading) => {
      const prefix = "#".repeat(Math.min(heading.level + 1, 6));
      lines.push(`${prefix} ${escapeMarkdown(heading.text)}`);
    });
  }

  const text = mainText(doc);
  if (text) {
    lines.push("", "## Page text", "", escapeMarkdown(text));
  }

  if (linkList.length > 0) {
    lines.push("", "## Links");
    linkList.forEach((link) => {
      const label = link.text ? escapeMarkdown(link.text) : link.url;
      lines.push(`- [${label}](${link.url})`);
    });
  }

  return {
    url,
    title,
    description,
    headings,
    links: linkList,
    extraction: "flyscrape-basic",
    markdown: lines.join("\n"),
  };
}
