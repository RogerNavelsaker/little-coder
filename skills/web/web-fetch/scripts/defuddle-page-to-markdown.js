var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/defuddle/dist/index.js
var require_dist = __commonJS((exports, module) => {
  (function(t, e) {
    typeof exports == "object" && typeof module == "object" ? module.exports = e() : typeof define == "function" && define.amd ? define([], e) : typeof exports == "object" ? exports.Defuddle = e() : t.Defuddle = e();
  })(typeof self != "undefined" ? self : exports, () => (() => {
    var t = { 0: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.mathRules = e2.createCleanMathEl = undefined;
      const n2 = r2(282);
      e2.createCleanMathEl = (t3, e3, r3, n3) => {
        const o = t3.createElement("math");
        if (o.setAttribute("xmlns", "http://www.w3.org/1998/Math/MathML"), o.setAttribute("display", n3 ? "block" : "inline"), o.setAttribute("data-latex", r3 || ""), e3 == null ? undefined : e3.mathml) {
          const r4 = t3.createElement("div");
          r4.innerHTML = e3.mathml;
          const n4 = r4.querySelector("math");
          n4 && (o.innerHTML = n4.innerHTML);
        } else
          r3 && (o.textContent = r3);
        return o;
      }, e2.mathRules = [{ selector: n2.mathSelectors, element: "math", transform: (t3, r3) => {
        if (!function(t4) {
          return "classList" in t4 && "getAttribute" in t4 && "querySelector" in t4;
        }(t3))
          return t3;
        const o = (0, n2.getMathMLFromElement)(t3), i = (0, n2.getBasicLatexFromElement)(t3), s = (0, n2.isBlockDisplay)(t3), a = (0, e2.createCleanMathEl)(r3, o, i, s);
        if (t3.parentElement) {
          t3.parentElement.querySelectorAll('script[type^="math/"], .MathJax_Preview, script[type="text/javascript"][src*="mathjax"], script[type="text/javascript"][src*="katex"]').forEach((t4) => t4.remove());
        }
        return a;
      } }];
    }, 20: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.GrokExtractor = undefined;
      const n2 = r2(181);

      class o extends n2.ConversationExtractor {
        constructor(t3, e3) {
          super(t3, e3), this.messageContainerSelector = ".relative.group.flex.flex-col.justify-center.w-full", this.messageBubbles = t3.querySelectorAll(this.messageContainerSelector), this.footnotes = [], this.footnoteCounter = 0;
        }
        canExtract() {
          return !!this.messageBubbles && this.messageBubbles.length > 0;
        }
        extractMessages() {
          const t3 = [];
          return this.footnotes = [], this.footnoteCounter = 0, this.messageBubbles && this.messageBubbles.length !== 0 ? (this.messageBubbles.forEach((e3) => {
            var r3;
            const n3 = e3.classList.contains("items-end"), o2 = e3.classList.contains("items-start");
            if (!n3 && !o2)
              return;
            const i = e3.querySelector(".message-bubble");
            if (!i)
              return;
            let s = "", a = "", l = "";
            if (n3)
              s = i.textContent || "", a = "user", l = "You";
            else if (o2) {
              a = "assistant", l = "Grok";
              const t4 = i.cloneNode(true);
              (r3 = t4.querySelector(".relative.border.border-border-l1.bg-surface-base")) === null || r3 === undefined || r3.remove(), s = t4.innerHTML, s = this.processFootnotes(s);
            }
            s.trim() && t3.push({ author: l, content: s.trim(), metadata: { role: a } });
          }), t3) : t3;
        }
        getFootnotes() {
          return this.footnotes;
        }
        getMetadata() {
          var t3;
          const e3 = this.getTitle(), r3 = ((t3 = this.messageBubbles) === null || t3 === undefined ? undefined : t3.length) || 0;
          return { title: e3, site: "Grok", url: this.url, messageCount: r3, description: `Grok conversation with ${r3} messages` };
        }
        getTitle() {
          var t3, e3;
          const r3 = (t3 = this.document.title) === null || t3 === undefined ? undefined : t3.trim();
          if (r3 && r3 !== "Grok" && !r3.startsWith("Grok by "))
            return r3.replace(/\s-\s*Grok$/, "").trim();
          const n3 = this.document.querySelector(`${this.messageContainerSelector}.items-end`);
          if (n3) {
            const t4 = n3.querySelector(".message-bubble");
            if (t4) {
              const r4 = ((e3 = t4.textContent) === null || e3 === undefined ? undefined : e3.trim()) || "";
              return r4.length > 50 ? r4.slice(0, 50) + "..." : r4;
            }
          }
          return "Grok Conversation";
        }
        processFootnotes(t3) {
          return t3.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (t4, e3, r3) => {
            if (!e3 || e3.startsWith("#") || !e3.match(/^https?:\/\//i))
              return t4;
            let n3;
            if (this.footnotes.find((t5) => t5.url === e3))
              n3 = this.footnotes.findIndex((t5) => t5.url === e3) + 1;
            else {
              this.footnoteCounter++, n3 = this.footnoteCounter;
              let t5 = e3;
              try {
                const r4 = new URL(e3).hostname.replace(/^www\./, "");
                t5 = `<a href="${e3}" target="_blank" rel="noopener noreferrer">${r4}</a>`;
              } catch (r4) {
                t5 = `<a href="${e3}" target="_blank" rel="noopener noreferrer">${e3}</a>`, console.warn(`GrokExtractor: Could not parse URL for footnote: ${e3}`);
              }
              this.footnotes.push({ url: e3, text: t5 });
            }
            return `${r3}<sup id="fnref:${n3}" class="footnote-ref"><a href="#fn:${n3}" class="footnote-link">${n3}</a></sup>`;
          });
        }
      }
      e2.GrokExtractor = o;
    }, 64: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.XArticleExtractor = undefined;
      const n2 = r2(279), o = '[data-testid="twitterArticleRichTextView"]', i = '[data-testid="twitter-article-title"]', s = '[itemprop="author"]', a = 'meta[itemprop="name"]', l = 'meta[itemprop="additionalName"]', c = '[data-testid="tweetPhoto"] img', u = ".longform-unstyled, .public-DraftStyleDefault-block", d = 'span[style*="font-weight: bold"]', m = "[data-offset-key]", h = '[data-testid="simpleTweet"]', f = '[data-testid="tweetText"]', p = '[data-testid="User-Name"]', g = '[data-testid="markdown-code-block"]';

      class v extends n2.BaseExtractor {
        constructor(t3, e3, r3) {
          super(t3, e3, r3), this.articleContainer = t3.querySelector(o);
        }
        canExtract() {
          return !!this.articleContainer;
        }
        extract() {
          const t3 = this.extractTitle(), e3 = this.extractAuthor(), r3 = this.extractContent(), n3 = this.createDescription();
          return { content: r3, contentHtml: r3, extractedContent: { articleId: this.getArticleId() }, variables: { title: t3, author: e3, site: "X (Twitter)", description: n3 } };
        }
        extractTitle() {
          var t3;
          const e3 = this.document.querySelector(i);
          return ((t3 = e3 == null ? undefined : e3.textContent) === null || t3 === undefined ? undefined : t3.trim()) || "Untitled X Article";
        }
        extractAuthor() {
          var t3, e3;
          const r3 = this.document.querySelector(s);
          if (!r3)
            return this.getAuthorFromUrl();
          const n3 = (t3 = r3.querySelector(a)) === null || t3 === undefined ? undefined : t3.getAttribute("content"), o2 = (e3 = r3.querySelector(l)) === null || e3 === undefined ? undefined : e3.getAttribute("content");
          return n3 && o2 ? `${n3} (@${o2})` : n3 || o2 || this.getAuthorFromUrl();
        }
        getAuthorFromUrl() {
          const t3 = this.url.match(/\/([a-zA-Z][a-zA-Z0-9_]{0,14})\/article\/\d+/);
          return t3 ? `@${t3[1]}` : this.getAuthorFromOgTitle();
        }
        getAuthorFromOgTitle() {
          var t3;
          const e3 = (((t3 = this.document.querySelector('meta[property="og:title"]')) === null || t3 === undefined ? undefined : t3.getAttribute("content")) || "").match(/^(?:\(\d+\)\s+)?(.+?)\s+on\s+X\s*:/);
          return e3 ? e3[1].trim() : "Unknown";
        }
        getArticleId() {
          const t3 = this.url.match(/article\/(\d+)/);
          return t3 ? t3[1] : "";
        }
        extractContent() {
          if (!this.articleContainer)
            return "";
          const t3 = this.articleContainer.cloneNode(true);
          return this.cleanContent(t3), `<article class="x-article">${t3.innerHTML}</article>`;
        }
        cleanContent(t3) {
          const e3 = t3.ownerDocument || this.document;
          this.convertEmbeddedTweets(t3, e3), this.convertCodeBlocks(t3, e3), this.convertHeaders(t3, e3), this.unwrapLinkedImages(t3, e3), this.upgradeImageQuality(t3), this.convertBoldSpans(t3, e3), this.convertDraftParagraphs(t3, e3), this.removeDraftAttributes(t3);
        }
        convertEmbeddedTweets(t3, e3) {
          t3.querySelectorAll(h).forEach((t4) => {
            var r3, n3, o2, i2, s2;
            const a2 = e3.createElement("blockquote");
            a2.className = "embedded-tweet";
            const l2 = t4.querySelector(p), c2 = l2 == null ? undefined : l2.querySelectorAll("a"), u2 = ((n3 = (r3 = c2 == null ? undefined : c2[0]) === null || r3 === undefined ? undefined : r3.textContent) === null || n3 === undefined ? undefined : n3.trim()) || "", d2 = ((i2 = (o2 = c2 == null ? undefined : c2[1]) === null || o2 === undefined ? undefined : o2.textContent) === null || i2 === undefined ? undefined : i2.trim()) || "", m2 = t4.querySelector(f), h2 = ((s2 = m2 == null ? undefined : m2.textContent) === null || s2 === undefined ? undefined : s2.trim()) || "";
            if (u2 || d2) {
              const t5 = e3.createElement("cite");
              t5.textContent = d2 ? `${u2} ${d2}` : u2, a2.appendChild(t5);
            }
            if (h2) {
              const t5 = e3.createElement("p");
              t5.textContent = h2, a2.appendChild(t5);
            }
            t4.replaceWith(a2);
          });
        }
        convertCodeBlocks(t3, e3) {
          t3.querySelectorAll(g).forEach((t4) => {
            var r3;
            const n3 = t4.querySelector("pre"), o2 = t4.querySelector("code");
            if (!n3 || !o2)
              return;
            let i2 = "";
            const s2 = o2.className.match(/language-(\w+)/);
            if (s2)
              i2 = s2[1];
            else {
              const e4 = t4.querySelector("span");
              i2 = ((r3 = e4 == null ? undefined : e4.textContent) === null || r3 === undefined ? undefined : r3.trim()) || "";
            }
            const a2 = e3.createElement("pre"), l2 = e3.createElement("code");
            i2 && (l2.setAttribute("data-lang", i2), l2.className = `language-${i2}`), l2.textContent = o2.textContent || "", a2.appendChild(l2), t4.replaceWith(a2);
          });
        }
        convertHeaders(t3, e3) {
          t3.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((t4) => {
            var r3;
            const n3 = t4.tagName.toLowerCase(), o2 = ((r3 = t4.textContent) === null || r3 === undefined ? undefined : r3.trim()) || "";
            if (!o2)
              return;
            const i2 = e3.createElement(n3);
            i2.textContent = o2, t4.replaceWith(i2);
          });
        }
        unwrapLinkedImages(t3, e3) {
          t3.querySelectorAll(c).forEach((r3) => {
            var n3;
            const o2 = r3.closest("a");
            if (!o2 || !t3.contains(o2))
              return;
            let i2 = r3.getAttribute("src") || "";
            const s2 = ((n3 = r3.getAttribute("alt")) === null || n3 === undefined ? undefined : n3.replace(/\s+/g, " ").trim()) || "Image";
            i2 = i2.includes("&name=") ? i2.replace(/&name=\w+/, "&name=large") : i2.includes("?") ? `${i2}&name=large` : `${i2}?name=large`;
            const a2 = e3.createElement("img");
            a2.setAttribute("src", i2), a2.setAttribute("alt", s2), o2.replaceWith(a2);
          });
        }
        upgradeImageQuality(t3) {
          t3.querySelectorAll(c).forEach((t4) => {
            const e3 = t4.getAttribute("src");
            e3 && (e3.includes("&name=") ? t4.setAttribute("src", e3.replace(/&name=\w+/, "&name=large")) : e3.includes("?") ? t4.setAttribute("src", `${e3}&name=large`) : t4.setAttribute("src", `${e3}?name=large`));
          });
        }
        convertDraftParagraphs(t3, e3) {
          t3.querySelectorAll(u).forEach((t4) => {
            const r3 = e3.createElement("p"), n3 = (t5) => {
              if (t5.nodeType === 3)
                r3.appendChild(e3.createTextNode(t5.textContent || ""));
              else if (t5.nodeType === 1) {
                const o2 = t5, i2 = o2.tagName.toLowerCase();
                if (i2 === "strong") {
                  const t6 = e3.createElement("strong");
                  t6.textContent = o2.textContent || "", r3.appendChild(t6);
                } else if (i2 === "a") {
                  const t6 = e3.createElement("a");
                  t6.setAttribute("href", o2.getAttribute("href") || ""), t6.textContent = o2.textContent || "", r3.appendChild(t6);
                } else if (i2 === "code") {
                  const t6 = e3.createElement("code");
                  t6.textContent = o2.textContent || "", r3.appendChild(t6);
                } else
                  o2.childNodes.forEach((t6) => n3(t6));
              }
            };
            t4.childNodes.forEach((t5) => n3(t5)), t4.replaceWith(r3);
          });
        }
        convertBoldSpans(t3, e3) {
          t3.querySelectorAll(d).forEach((t4) => {
            const r3 = e3.createElement("strong");
            r3.textContent = t4.textContent || "", t4.replaceWith(r3);
          });
        }
        removeDraftAttributes(t3) {
          t3.querySelectorAll(m).forEach((t4) => {
            t4.removeAttribute("data-offset-key");
          });
        }
        createDescription() {
          var t3, e3;
          const r3 = ((e3 = (t3 = this.articleContainer) === null || t3 === undefined ? undefined : t3.textContent) === null || e3 === undefined ? undefined : e3.trim()) || "";
          return r3.slice(0, 140) + (r3.length > 140 ? "..." : "");
        }
      }
      e2.XArticleExtractor = v;
    }, 181: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.ConversationExtractor = undefined;
      const n2 = r2(279), o = r2(628);

      class i extends n2.BaseExtractor {
        getFootnotes() {
          return [];
        }
        extract() {
          var t3;
          const e3 = this.extractMessages(), r3 = this.getMetadata(), n3 = this.getFootnotes(), i2 = this.createContentHtml(e3, n3), s = this.document.implementation.createHTMLDocument(), a = s.createElement("article");
          a.innerHTML = i2, s.body.appendChild(a);
          const l = new o.Defuddle(s).parse(), c = l.content;
          return { content: c, contentHtml: c, extractedContent: { messageCount: e3.length.toString() }, variables: { title: r3.title || "Conversation", site: r3.site, description: r3.description || `${r3.site} conversation with ${e3.length} messages`, wordCount: ((t3 = l.wordCount) === null || t3 === undefined ? undefined : t3.toString()) || "" } };
        }
        createContentHtml(t3, e3) {
          return `${t3.map((e4, r3) => {
            const n3 = e4.timestamp ? `<div class="message-timestamp">${e4.timestamp}</div>` : "", o2 = /<p[^>]*>[\s\S]*?<\/p>/i.test(e4.content) ? e4.content : `<p>${e4.content}</p>`, i2 = e4.metadata ? Object.entries(e4.metadata).map(([t4, e5]) => `data-${t4}="${e5}"`).join(" ") : "";
            return `
			<div class="message message-${e4.author.toLowerCase()}" ${i2}>
				<div class="message-header">
					<p class="message-author"><strong>${e4.author}</strong></p>
					${n3}
				</div>
				<div class="message-content">
					${o2}
				</div>
			</div>${r3 < t3.length - 1 ? `
<hr>` : ""}`;
          }).join(`
`).trim()}
${e3.length > 0 ? `
			<div id="footnotes">
				<ol>
					${e3.map((t4, e4) => `
						<li class="footnote" id="fn:${e4 + 1}">
							<p>
								<a href="${t4.url}" target="_blank">${t4.text}</a>&nbsp;<a href="#fnref:${e4 + 1}" class="footnote-backref">↩</a>
							</p>
						</li>
					`).join("")}
				</ol>
			</div>` : ""}`.trim();
        }
      }
      e2.ConversationExtractor = i;
    }, 248: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.TwitterExtractor = undefined;
      const n2 = r2(279);

      class o extends n2.BaseExtractor {
        constructor(t3, e3) {
          var r3;
          super(t3, e3), this.mainTweet = null, this.threadTweets = [];
          const n3 = t3.querySelector('[aria-label="Timeline: Conversation"]');
          if (!n3) {
            const e4 = t3.querySelector('article[data-testid="tweet"]');
            return void (e4 && (this.mainTweet = e4));
          }
          let o2 = Array.from(n3.querySelectorAll('article[data-testid="tweet"]'));
          const i = (r3 = n3.querySelector("section, h2")) === null || r3 === undefined ? undefined : r3.parentElement;
          if (i) {
            const t4 = o2.findIndex((t5) => i.compareDocumentPosition(t5) & Node.DOCUMENT_POSITION_FOLLOWING);
            t4 !== -1 && (o2 = o2.slice(0, t4));
          }
          this.mainTweet = o2[0] || null, this.threadTweets = o2.slice(1);
        }
        canExtract() {
          return !!this.mainTweet;
        }
        extract() {
          const t3 = this.extractTweet(this.mainTweet), e3 = this.threadTweets.map((t4) => this.extractTweet(t4)).join(`
<hr>
`), r3 = `
			<div class="tweet-thread">
				<div class="main-tweet">
					${t3}
				</div>
				${e3 ? `
					<hr>
					<div class="thread-tweets">
						${e3}
					</div>
				` : ""}
			</div>
		`.trim(), n3 = this.getTweetId(), o2 = this.getTweetAuthor();
          return { content: r3, contentHtml: r3, extractedContent: { tweetId: n3, tweetAuthor: o2 }, variables: { title: `Thread by ${o2}`, author: o2, site: "X (Twitter)", description: this.createDescription(this.mainTweet) } };
        }
        formatTweetText(t3) {
          if (!t3)
            return "";
          const e3 = this.document.createElement("div");
          e3.innerHTML = t3, e3.querySelectorAll("a").forEach((t4) => {
            var e4;
            const r3 = ((e4 = t4.textContent) === null || e4 === undefined ? undefined : e4.trim()) || "";
            t4.replaceWith(r3);
          }), e3.querySelectorAll("span, div").forEach((t4) => {
            t4.replaceWith(...Array.from(t4.childNodes));
          });
          return e3.innerHTML.split(`
`).map((t4) => t4.trim()).filter((t4) => t4).map((t4) => `<p>${t4}</p>`).join(`
`);
        }
        extractTweet(t3) {
          var e3, r3, n3;
          if (!t3)
            return "";
          const o2 = t3.cloneNode(true);
          o2.querySelectorAll('img[src*="/emoji/"]').forEach((t4) => {
            if (t4.tagName.toLowerCase() === "img" && t4.getAttribute("alt")) {
              const e4 = t4.getAttribute("alt");
              e4 && t4.replaceWith(e4);
            }
          });
          const i = ((e3 = o2.querySelector('[data-testid="tweetText"]')) === null || e3 === undefined ? undefined : e3.innerHTML) || "", s = this.formatTweetText(i), a = this.extractImages(t3), l = this.extractUserInfo(t3), c = (n3 = (r3 = t3.querySelector('[aria-labelledby*="id__"]')) === null || r3 === undefined ? undefined : r3.querySelector('[data-testid="User-Name"]')) === null || n3 === undefined ? undefined : n3.closest('[aria-labelledby*="id__"]'), u = c ? this.extractTweet(c) : "";
          return `
			<div class="tweet">
				<div class="tweet-header">
					<span class="tweet-author"><strong>${l.fullName}</strong> <span class="tweet-handle">${l.handle}</span></span>
					${l.date ? `<a href="${l.permalink}" class="tweet-date">${l.date}</a>` : ""}
				</div>
				${s ? `<div class="tweet-text">${s}</div>` : ""}
				${a.length ? `
					<div class="tweet-media">
						${a.join(`
`)}
					</div>
				` : ""}
				${u ? `
					<blockquote class="quoted-tweet">
						${u}
					</blockquote>
				` : ""}
			</div>
		`.trim();
        }
        extractUserInfo(t3) {
          var e3, r3, n3, o2, i, s, a, l, c;
          const u = t3.querySelector('[data-testid="User-Name"]');
          if (!u)
            return { fullName: "", handle: "", date: "", permalink: "" };
          const d = u.querySelectorAll("a");
          let m = ((r3 = (e3 = d == null ? undefined : d[0]) === null || e3 === undefined ? undefined : e3.textContent) === null || r3 === undefined ? undefined : r3.trim()) || "", h = ((o2 = (n3 = d == null ? undefined : d[1]) === null || n3 === undefined ? undefined : n3.textContent) === null || o2 === undefined ? undefined : o2.trim()) || "";
          m && h || (m = ((s = (i = u.querySelector('span[style*="color: rgb(15, 20, 25)"] span')) === null || i === undefined ? undefined : i.textContent) === null || s === undefined ? undefined : s.trim()) || "", h = ((l = (a = u.querySelector('span[style*="color: rgb(83, 100, 113)"]')) === null || a === undefined ? undefined : a.textContent) === null || l === undefined ? undefined : l.trim()) || "");
          const f = t3.querySelector("time"), p = (f == null ? undefined : f.getAttribute("datetime")) || "";
          return { fullName: m, handle: h, date: p ? new Date(p).toISOString().split("T")[0] : "", permalink: ((c = f == null ? undefined : f.closest("a")) === null || c === undefined ? undefined : c.href) || "" };
        }
        extractImages(t3) {
          var e3, r3;
          const n3 = ['[data-testid="tweetPhoto"]', '[data-testid="tweet-image"]', 'img[src*="media"]'], o2 = [], i = (r3 = (e3 = t3.querySelector('[aria-labelledby*="id__"]')) === null || e3 === undefined ? undefined : e3.querySelector('[data-testid="User-Name"]')) === null || r3 === undefined ? undefined : r3.closest('[aria-labelledby*="id__"]');
          for (const e4 of n3) {
            t3.querySelectorAll(e4).forEach((t4) => {
              var e5, r4;
              if (!(i == null ? undefined : i.contains(t4)) && t4.tagName.toLowerCase() === "img" && t4.getAttribute("alt")) {
                const n4 = ((e5 = t4.getAttribute("src")) === null || e5 === undefined ? undefined : e5.replace(/&name=\w+$/, "&name=large")) || "", i2 = ((r4 = t4.getAttribute("alt")) === null || r4 === undefined ? undefined : r4.replace(/\s+/g, " ").trim()) || "";
                o2.push(`<img src="${n4}" alt="${i2}" />`);
              }
            });
          }
          return o2;
        }
        getTweetId() {
          const t3 = this.url.match(/status\/(\d+)/);
          return (t3 == null ? undefined : t3[1]) || "";
        }
        getTweetAuthor() {
          var t3, e3, r3;
          const n3 = (t3 = this.mainTweet) === null || t3 === undefined ? undefined : t3.querySelector('[data-testid="User-Name"]'), o2 = n3 == null ? undefined : n3.querySelectorAll("a"), i = ((r3 = (e3 = o2 == null ? undefined : o2[1]) === null || e3 === undefined ? undefined : e3.textContent) === null || r3 === undefined ? undefined : r3.trim()) || "";
          return i.startsWith("@") ? i : `@${i}`;
        }
        createDescription(t3) {
          var e3;
          if (!t3)
            return "";
          return (((e3 = t3.querySelector('[data-testid="tweetText"]')) === null || e3 === undefined ? undefined : e3.textContent) || "").trim().slice(0, 140).replace(/\s+/g, " ");
        }
      }
      e2.TwitterExtractor = o;
    }, 258: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.YoutubeExtractor = undefined;
      const n2 = r2(279);

      class o extends n2.BaseExtractor {
        constructor(t3, e3, r3) {
          super(t3, e3, r3), this.videoElement = t3.querySelector("video"), this.schemaOrgData = r3;
        }
        canExtract() {
          return true;
        }
        extract() {
          const t3 = this.getVideoData(), e3 = this.getChannelName(t3), r3 = t3.description || "", n3 = this.formatDescription(r3), o2 = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${this.getVideoId()}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><br>${n3}`;
          return { content: o2, contentHtml: o2, extractedContent: { videoId: this.getVideoId(), author: e3 }, variables: { title: t3.name || "", author: e3, site: "YouTube", image: Array.isArray(t3.thumbnailUrl) && t3.thumbnailUrl[0] || "", published: t3.uploadDate, description: r3.slice(0, 200).trim() } };
        }
        formatDescription(t3) {
          return `<p>${t3.replace(/\n/g, "<br>")}</p>`;
        }
        getVideoData() {
          if (!this.schemaOrgData)
            return {};
          return (Array.isArray(this.schemaOrgData) ? this.schemaOrgData.find((t3) => t3["@type"] === "VideoObject") : this.schemaOrgData["@type"] === "VideoObject" ? this.schemaOrgData : null) || {};
        }
        getChannelName(t3) {
          const e3 = this.getChannelNameFromDom();
          if (e3)
            return e3;
          const r3 = this.getChannelNameFromPlayerResponse();
          return r3 || ((t3 == null ? undefined : t3.author) || "");
        }
        getChannelNameFromDom() {
          var t3;
          const e3 = ['ytd-video-owner-renderer #channel-name a[href^="/@"]', '#owner-name a[href^="/@"]'];
          for (const r3 of e3) {
            const e4 = this.document.querySelector(r3), n3 = (t3 = e4 == null ? undefined : e4.textContent) === null || t3 === undefined ? undefined : t3.trim();
            if (n3)
              return n3;
          }
          return this.getChannelNameFromMicrodata();
        }
        getChannelNameFromMicrodata() {
          var t3;
          const e3 = this.document.querySelector('[itemprop="author"]');
          if (!e3)
            return "";
          const r3 = e3.querySelector('meta[itemprop="name"]');
          if (r3 == null ? undefined : r3.getAttribute("content"))
            return r3.getAttribute("content").trim();
          const n3 = e3.querySelector('link[itemprop="name"]');
          if (n3 == null ? undefined : n3.getAttribute("content"))
            return n3.getAttribute("content").trim();
          const o2 = e3.querySelector('[itemprop="name"], a, span');
          return ((t3 = o2 == null ? undefined : o2.textContent) === null || t3 === undefined ? undefined : t3.trim()) || "";
        }
        getChannelNameFromPlayerResponse() {
          var t3, e3, r3, n3;
          const o2 = this.parseInlineJson("ytInitialPlayerResponse");
          if (!o2)
            return "";
          const i = ((t3 = o2 == null ? undefined : o2.videoDetails) === null || t3 === undefined ? undefined : t3.author) || ((e3 = o2 == null ? undefined : o2.videoDetails) === null || e3 === undefined ? undefined : e3.ownerChannelName);
          if (i)
            return i;
          return ((n3 = (r3 = o2 == null ? undefined : o2.microformat) === null || r3 === undefined ? undefined : r3.playerMicroformatRenderer) === null || n3 === undefined ? undefined : n3.ownerChannelName) || "";
        }
        parseInlineJson(t3) {
          const e3 = Array.from(this.document.querySelectorAll("script"));
          for (const r3 of e3) {
            const e4 = r3.textContent || "";
            if (!e4.includes(t3))
              continue;
            const n3 = e4.indexOf("{", e4.indexOf(t3));
            if (n3 === -1)
              continue;
            let o2 = 0;
            for (let t4 = n3;t4 < e4.length; t4++) {
              const r4 = e4[t4];
              if (r4 === "{")
                o2 += 1;
              else if (r4 === "}" && (o2 -= 1, o2 === 0)) {
                const r5 = e4.slice(n3, t4 + 1);
                try {
                  return JSON.parse(r5);
                } catch (t5) {
                  console.error("YoutubeExtractor: failed to parse inline JSON", t5);
                  break;
                }
              }
            }
          }
          return null;
        }
        getVideoId() {
          const t3 = new URL(this.url);
          return t3.hostname === "youtu.be" ? t3.pathname.slice(1) : new URLSearchParams(t3.search).get("v") || "";
        }
      }
      e2.YoutubeExtractor = o;
    }, 279: function(t2, e2) {
      var r2 = this && this.__awaiter || function(t3, e3, r3, n2) {
        return new (r3 || (r3 = Promise))(function(o, i) {
          function s(t4) {
            try {
              l(n2.next(t4));
            } catch (t5) {
              i(t5);
            }
          }
          function a(t4) {
            try {
              l(n2.throw(t4));
            } catch (t5) {
              i(t5);
            }
          }
          function l(t4) {
            var e4;
            t4.done ? o(t4.value) : (e4 = t4.value, e4 instanceof r3 ? e4 : new r3(function(t5) {
              t5(e4);
            })).then(s, a);
          }
          l((n2 = n2.apply(t3, e3 || [])).next());
        });
      };
      Object.defineProperty(e2, "__esModule", { value: true }), e2.BaseExtractor = undefined;
      e2.BaseExtractor = class {
        constructor(t3, e3, r3) {
          this.document = t3, this.url = e3, this.schemaOrgData = r3;
        }
        canExtractAsync() {
          return false;
        }
        extractAsync() {
          return r2(this, undefined, undefined, function* () {
            return this.extract();
          });
        }
      };
    }, 282: (t2, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.mathSelectors = e2.isBlockDisplay = e2.getBasicLatexFromElement = e2.getMathMLFromElement = undefined;
      e2.getMathMLFromElement = (t3) => {
        if (t3.tagName.toLowerCase() === "math") {
          const e4 = t3.getAttribute("display") === "block";
          return { mathml: t3.outerHTML, latex: t3.getAttribute("alttext") || null, isBlock: e4 };
        }
        const e3 = t3.getAttribute("data-mathml");
        if (e3) {
          const r3 = (t3.ownerDocument || document).createElement("div");
          r3.innerHTML = e3;
          const n3 = r3.querySelector("math");
          if (n3) {
            const t4 = n3.getAttribute("display") === "block";
            return { mathml: n3.outerHTML, latex: n3.getAttribute("alttext") || null, isBlock: t4 };
          }
        }
        const r2 = t3.querySelector(".MJX_Assistive_MathML, mjx-assistive-mml");
        if (r2) {
          const t4 = r2.querySelector("math");
          if (t4) {
            const e4 = t4.getAttribute("display"), n3 = r2.getAttribute("display"), o = e4 === "block" || n3 === "block";
            return { mathml: t4.outerHTML, latex: t4.getAttribute("alttext") || null, isBlock: o };
          }
        }
        const n2 = t3.querySelector(".katex-mathml math");
        return n2 ? { mathml: n2.outerHTML, latex: null, isBlock: false } : null;
      };
      e2.getBasicLatexFromElement = (t3) => {
        var e3, r2, n2;
        const o = t3.getAttribute("data-latex");
        if (o)
          return o;
        if (t3.tagName.toLowerCase() === "img" && t3.classList.contains("latex")) {
          const e4 = t3.getAttribute("alt");
          if (e4)
            return e4;
          const r3 = t3.getAttribute("src");
          if (r3) {
            const t4 = r3.match(/latex\.php\?latex=([^&]+)/);
            if (t4)
              return decodeURIComponent(t4[1]).replace(/\+/g, " ").replace(/%5C/g, "\\");
          }
        }
        const i = t3.querySelector('annotation[encoding="application/x-tex"]');
        if (i == null ? undefined : i.textContent)
          return i.textContent.trim();
        if (t3.matches(".katex")) {
          const e4 = t3.querySelector('.katex-mathml annotation[encoding="application/x-tex"]');
          if (e4 == null ? undefined : e4.textContent)
            return e4.textContent.trim();
        }
        if (t3.matches('script[type="math/tex"]') || t3.matches('script[type="math/tex; mode=display"]'))
          return ((e3 = t3.textContent) === null || e3 === undefined ? undefined : e3.trim()) || null;
        if (t3.parentElement) {
          const e4 = t3.parentElement.querySelector('script[type="math/tex"], script[type="math/tex; mode=display"]');
          if (e4)
            return ((r2 = e4.textContent) === null || r2 === undefined ? undefined : r2.trim()) || null;
        }
        return t3.tagName.toLowerCase() === "math" && ((n2 = t3.textContent) === null || n2 === undefined ? undefined : n2.trim()) ? t3.textContent.trim() : t3.getAttribute("alt") || null;
      };
      e2.isBlockDisplay = (t3) => {
        if (t3.getAttribute("display") === "block")
          return true;
        const e3 = t3.className.toLowerCase();
        if (e3.includes("display") || e3.includes("block"))
          return true;
        if (t3.closest('.katex-display, .MathJax_Display, [data-display="block"]'))
          return true;
        const r2 = t3.previousElementSibling;
        if ((r2 == null ? undefined : r2.tagName.toLowerCase()) === "p")
          return true;
        if (t3.matches(".mwe-math-fallback-image-display"))
          return true;
        if (t3.matches(".katex"))
          return t3.closest(".katex-display") !== null;
        if (t3.hasAttribute("display"))
          return t3.getAttribute("display") === "true";
        if (t3.matches('script[type="math/tex; mode=display"]'))
          return true;
        if (t3.hasAttribute("display"))
          return t3.getAttribute("display") === "true";
        const n2 = t3.closest("[display]");
        return !!n2 && n2.getAttribute("display") === "true";
      }, e2.mathSelectors = ['img.latex[src*="latex.php"]', "span.MathJax", "mjx-container", 'script[type="math/tex"]', 'script[type="math/tex; mode=display"]', '.MathJax_Preview + script[type="math/tex"]', ".MathJax_Display", ".MathJax_SVG", ".MathJax_MathML", ".mwe-math-element", ".mwe-math-fallback-image-inline", ".mwe-math-fallback-image-display", ".mwe-math-mathml-inline", ".mwe-math-mathml-display", ".katex", ".katex-display", ".katex-mathml", ".katex-html", "[data-katex]", 'script[type="math/katex"]', "math", "[data-math]", "[data-latex]", "[data-tex]", 'script[type^="math/"]', 'annotation[encoding="application/x-tex"]'].join(",");
    }, 397: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.ClaudeExtractor = undefined;
      const n2 = r2(181);

      class o extends n2.ConversationExtractor {
        constructor(t3, e3) {
          super(t3, e3), this.articles = t3.querySelectorAll('div[data-testid="user-message"], div[data-testid="assistant-message"], div.font-claude-response');
        }
        canExtract() {
          return !!this.articles && this.articles.length > 0;
        }
        extractMessages() {
          const t3 = [];
          return this.articles ? (this.articles.forEach((e3) => {
            let r3, n3;
            if (e3.hasAttribute("data-testid")) {
              if (e3.getAttribute("data-testid") !== "user-message")
                return;
              r3 = "you", n3 = e3.innerHTML;
            } else {
              if (!e3.classList.contains("font-claude-response"))
                return;
              r3 = "assistant";
              n3 = (e3.querySelector(".standard-markdown") || e3).innerHTML;
            }
            n3 && (n3 = n3.replace(/\u200B/g, "").replace(/<p[^>]*>\s*<\/p>/g, ""), t3.push({ author: r3 === "you" ? "You" : "Claude", content: n3.trim(), metadata: { role: r3 } }));
          }), t3) : t3;
        }
        getMetadata() {
          const t3 = this.getTitle(), e3 = this.extractMessages();
          return { title: t3, site: "Claude", url: this.url, messageCount: e3.length, description: `Claude conversation with ${e3.length} messages` };
        }
        getTitle() {
          var t3, e3, r3, n3, o2;
          const i = (t3 = this.document.title) === null || t3 === undefined ? undefined : t3.trim();
          if (i && i !== "Claude")
            return i.replace(/ - Claude$/, "");
          const s = (r3 = (e3 = this.document.querySelector("header .font-tiempos")) === null || e3 === undefined ? undefined : e3.textContent) === null || r3 === undefined ? undefined : r3.trim();
          if (s)
            return s;
          const a = (o2 = (n3 = this.articles) === null || n3 === undefined ? undefined : n3.item(0)) === null || o2 === undefined ? undefined : o2.querySelector('[data-testid="user-message"]');
          if (a) {
            const t4 = a.textContent || "";
            return t4.length > 50 ? t4.slice(0, 50) + "..." : t4;
          }
          return "Claude Conversation";
        }
      }
      e2.ClaudeExtractor = o;
    }, 458: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.HackerNewsExtractor = undefined;
      const n2 = r2(279);

      class o extends n2.BaseExtractor {
        constructor(t3, e3) {
          super(t3, e3), this.mainPost = t3.querySelector(".fatitem"), this.isCommentPage = this.detectCommentPage(), this.mainComment = this.isCommentPage ? this.findMainComment() : null;
        }
        detectCommentPage() {
          var t3;
          return !!((t3 = this.mainPost) === null || t3 === undefined ? undefined : t3.querySelector('.navs a[href*="parent"]'));
        }
        findMainComment() {
          var t3;
          return ((t3 = this.mainPost) === null || t3 === undefined ? undefined : t3.querySelector(".comment")) || null;
        }
        canExtract() {
          return !!this.mainPost;
        }
        extract() {
          const t3 = this.getPostContent(), e3 = this.extractComments(), r3 = this.createContentHtml(t3, e3), n3 = this.getPostTitle(), o2 = this.getPostAuthor(), i = this.createDescription(), s = this.getPostDate();
          return { content: r3, contentHtml: r3, extractedContent: { postId: this.getPostId(), postAuthor: o2 }, variables: { title: n3, author: o2, site: "Hacker News", description: i, published: s } };
        }
        createContentHtml(t3, e3) {
          return `
			<div class="hackernews-post">
				<div class="post-content">
					${t3}
				</div>
				${e3 ? `
					<hr>
					<h2>Comments</h2>
					<div class="hackernews-comments">
						${e3}
					</div>
				` : ""}
			</div>
		`.trim();
        }
        getPostContent() {
          var t3, e3, r3, n3, o2, i;
          if (!this.mainPost)
            return "";
          if (this.isCommentPage && this.mainComment) {
            const i2 = ((t3 = this.mainComment.querySelector(".hnuser")) === null || t3 === undefined ? undefined : t3.textContent) || "[deleted]", s2 = ((e3 = this.mainComment.querySelector(".commtext")) === null || e3 === undefined ? undefined : e3.innerHTML) || "", a2 = this.mainComment.querySelector(".age"), l2 = ((a2 == null ? undefined : a2.getAttribute("title")) || "").split("T")[0] || "", c2 = ((n3 = (r3 = this.mainComment.querySelector(".score")) === null || r3 === undefined ? undefined : r3.textContent) === null || n3 === undefined ? undefined : n3.trim()) || "", u = ((o2 = this.mainPost.querySelector('.navs a[href*="parent"]')) === null || o2 === undefined ? undefined : o2.getAttribute("href")) || "";
            return `
				<div class="comment main-comment">
					<div class="comment-metadata">
						<span class="comment-author"><strong>${i2}</strong></span> •
						<span class="comment-date">${l2}</span>
						${c2 ? ` • <span class="comment-points">${c2}</span>` : ""}
						${u ? ` • <a href="https://news.ycombinator.com/${u}" class="parent-link">parent</a>` : ""}
					</div>
					<div class="comment-content">${s2}</div>
				</div>
			`.trim();
          }
          const s = this.mainPost.querySelector("tr.athing"), a = (s == null || s.nextElementSibling, ((i = s == null ? undefined : s.querySelector(".titleline a")) === null || i === undefined ? undefined : i.getAttribute("href")) || "");
          let l = "";
          a && (l += `<p><a href="${a}" target="_blank">${a}</a></p>`);
          const c = this.mainPost.querySelector(".toptext");
          return c && (l += `<div class="post-text">${c.innerHTML}</div>`), l;
        }
        extractComments() {
          const t3 = Array.from(this.document.querySelectorAll("tr.comtr"));
          return this.processComments(t3);
        }
        processComments(t3) {
          var e3, r3, n3, o2;
          let i = "";
          const s = new Set;
          let a = -1, l = [];
          for (const c of t3) {
            const t4 = c.getAttribute("id");
            if (!t4 || s.has(t4))
              continue;
            s.add(t4);
            const u = ((e3 = c.querySelector(".ind img")) === null || e3 === undefined ? undefined : e3.getAttribute("width")) || "0", d = parseInt(u) / 40, m = c.querySelector(".commtext"), h = ((r3 = c.querySelector(".hnuser")) === null || r3 === undefined ? undefined : r3.textContent) || "[deleted]", f = c.querySelector(".age"), p = ((o2 = (n3 = c.querySelector(".score")) === null || n3 === undefined ? undefined : n3.textContent) === null || o2 === undefined ? undefined : o2.trim()) || "";
            if (!m)
              continue;
            const g = `https://news.ycombinator.com/item?id=${t4}`, v = ((f == null ? undefined : f.getAttribute("title")) || "").split("T")[0] || "";
            if (d === 0) {
              for (;l.length > 0; )
                i += "</blockquote>", l.pop();
              i += "<blockquote>", l = [0], a = 0;
            } else if (d < a)
              for (;l.length > 0 && l[l.length - 1] >= d; )
                i += "</blockquote>", l.pop();
            else
              d > a && (i += "<blockquote>", l.push(d));
            i += `<div class="comment">
	<div class="comment-metadata">
		<span class="comment-author"><strong>${h}</strong></span> •
		<a href="${g}" class="comment-link">${v}</a>
		${p ? ` • <span class="comment-points">${p}</span>` : ""}
	</div>
	<div class="comment-content">${m.innerHTML}</div>
</div>`, a = d;
          }
          for (;l.length > 0; )
            i += "</blockquote>", l.pop();
          return i;
        }
        getPostId() {
          const t3 = this.url.match(/id=(\d+)/);
          return (t3 == null ? undefined : t3[1]) || "";
        }
        getPostTitle() {
          var t3, e3, r3, n3, o2;
          if (this.isCommentPage && this.mainComment) {
            const r4 = ((t3 = this.mainComment.querySelector(".hnuser")) === null || t3 === undefined ? undefined : t3.textContent) || "[deleted]", n4 = ((e3 = this.mainComment.querySelector(".commtext")) === null || e3 === undefined ? undefined : e3.textContent) || "";
            return `Comment by ${r4}: ${n4.trim().slice(0, 50) + (n4.length > 50 ? "..." : "")}`;
          }
          return ((o2 = (n3 = (r3 = this.mainPost) === null || r3 === undefined ? undefined : r3.querySelector(".titleline")) === null || n3 === undefined ? undefined : n3.textContent) === null || o2 === undefined ? undefined : o2.trim()) || "";
        }
        getPostAuthor() {
          var t3, e3, r3;
          return ((r3 = (e3 = (t3 = this.mainPost) === null || t3 === undefined ? undefined : t3.querySelector(".hnuser")) === null || e3 === undefined ? undefined : e3.textContent) === null || r3 === undefined ? undefined : r3.trim()) || "";
        }
        createDescription() {
          const t3 = this.getPostTitle(), e3 = this.getPostAuthor();
          return this.isCommentPage ? `Comment by ${e3} on Hacker News` : `${t3} - by ${e3} on Hacker News`;
        }
        getPostDate() {
          if (!this.mainPost)
            return "";
          const t3 = this.mainPost.querySelector(".age");
          return ((t3 == null ? undefined : t3.getAttribute("title")) || "").split("T")[0] || "";
        }
      }
      e2.HackerNewsExtractor = o;
    }, 552: (t2, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.isElement = function(t3) {
        return t3.nodeType === r2.ELEMENT_NODE;
      }, e2.isTextNode = function(t3) {
        return t3.nodeType === r2.TEXT_NODE;
      }, e2.isCommentNode = function(t3) {
        return t3.nodeType === r2.COMMENT_NODE;
      }, e2.getComputedStyle = function(t3) {
        const e3 = n2(t3.ownerDocument);
        return e3 ? e3.getComputedStyle(t3) : null;
      }, e2.getWindow = n2, e2.logDebug = function(t3, ...e3) {
        typeof window != "undefined" && window.defuddleDebug && console.log("Defuddle:", t3, ...e3);
      };
      const r2 = { ELEMENT_NODE: 1, ATTRIBUTE_NODE: 2, TEXT_NODE: 3, CDATA_SECTION_NODE: 4, ENTITY_REFERENCE_NODE: 5, ENTITY_NODE: 6, PROCESSING_INSTRUCTION_NODE: 7, COMMENT_NODE: 8, DOCUMENT_NODE: 9, DOCUMENT_TYPE_NODE: 10, DOCUMENT_FRAGMENT_NODE: 11, NOTATION_NODE: 12 };
      function n2(t3) {
        return t3.defaultView ? t3.defaultView : t3.ownerWindow ? t3.ownerWindow : t3.window ? t3.window : null;
      }
    }, 588: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.GitHubExtractor = undefined;
      const n2 = r2(279);

      class o extends n2.BaseExtractor {
        canExtract() {
          return ['meta[name="expected-hostname"][content="github.com"]', 'meta[name="octolytics-url"]', 'meta[name="github-keyboard-shortcuts"]', ".js-header-wrapper", "#js-repo-pjax-container"].some((t3) => this.document.querySelector(t3) !== null) && Object.values({ issue: ['[data-testid="issue-metadata-sticky"]', '[data-testid="issue-title"]'] }).some((t3) => t3.some((t4) => this.document.querySelector(t4) !== null));
        }
        extract() {
          return this.extractIssue();
        }
        extractIssue() {
          const t3 = this.extractRepoInfo(), e3 = this.extractIssueNumber();
          let r3 = "";
          const n3 = this.document.querySelector('[data-testid="issue-viewer-issue-container"]');
          if (n3) {
            const t4 = this.extractAuthor(n3, ['a[data-testid="issue-body-header-author"]', ".IssueBodyHeaderAuthor-module__authorLoginLink--_S7aT", ".ActivityHeader-module__AuthorLink--iofTU", 'a[href*="/users/"][data-hovercard-url*="/users/"]', 'a[aria-label*="profile"]']), e4 = n3.querySelector("relative-time"), o3 = (e4 == null ? undefined : e4.getAttribute("datetime")) || "", i2 = n3.querySelector('[data-testid="issue-body-viewer"] .markdown-body');
            if (i2) {
              const e5 = this.cleanBodyContent(i2);
              if (r3 += `<div class="issue-author"><strong>${t4}</strong>`, o3) {
                const t5 = new Date(o3).toISOString().split("T")[0];
                r3 += ` opened this issue on ${t5}`;
              }
              r3 += `</div>

`, r3 += `<div class="issue-body">${e5}</div>

`;
            }
          }
          const o2 = Array.from(this.document.querySelectorAll("[data-wrapper-timeline-id]")), i = new Set;
          return o2.forEach((t4) => {
            const e4 = t4.querySelector(".react-issue-comment");
            if (!e4)
              return;
            const n4 = t4.getAttribute("data-wrapper-timeline-id");
            if (!n4 || i.has(n4))
              return;
            i.add(n4);
            const o3 = this.extractAuthor(e4, [".ActivityHeader-module__AuthorLink--iofTU", 'a[data-testid="avatar-link"]', 'a[href^="/"][data-hovercard-url*="/users/"]']), s = e4.querySelector("relative-time"), a = (s == null ? undefined : s.getAttribute("datetime")) || "", l = e4.querySelector(".markdown-body");
            if (l) {
              const t5 = this.cleanBodyContent(l);
              if (t5) {
                if (r3 += `<div class="comment">
`, r3 += `<div class="comment-header"><strong>${o3}</strong>`, a) {
                  const t6 = new Date(a).toISOString().split("T")[0];
                  r3 += ` commented on ${t6}`;
                }
                r3 += `</div>
`, r3 += `<div class="comment-body">${t5}</div>
`, r3 += `</div>

`;
              }
            }
          }), { content: r3, contentHtml: r3, extractedContent: { type: "issue", issueNumber: e3, repository: t3.repo, owner: t3.owner }, variables: { title: this.document.title, author: "", site: `GitHub - ${t3.owner}/${t3.repo}`, description: this.createDescription(r3) } };
        }
        extractAuthor(t3, e3) {
          for (const r3 of e3) {
            const e4 = t3.querySelector(r3);
            if (e4) {
              const t4 = e4.getAttribute("href");
              if (t4) {
                if (t4.startsWith("/"))
                  return t4.substring(1);
                if (t4.includes("github.com/")) {
                  const e5 = t4.match(/github\.com\/([^\/\?#]+)/);
                  if (e5 && e5[1])
                    return e5[1];
                }
              }
            }
          }
          return "Unknown";
        }
        cleanBodyContent(t3) {
          const e3 = t3.cloneNode(true);
          return e3.querySelectorAll('button, [data-testid*="button"], [data-testid*="menu"]').forEach((t4) => t4.remove()), e3.querySelectorAll(".js-clipboard-copy, .zeroclipboard-container").forEach((t4) => t4.remove()), e3.innerHTML.trim();
        }
        extractIssueNumber() {
          var t3;
          const e3 = this.url.match(/\/(issues|pull)\/(\d+)/);
          if (e3)
            return e3[2];
          const r3 = this.document.querySelector("h1"), n3 = (t3 = r3 == null ? undefined : r3.textContent) === null || t3 === undefined ? undefined : t3.match(/#(\d+)/);
          return n3 ? n3[1] : "";
        }
        extractRepoInfo() {
          const t3 = this.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
          if (t3)
            return { owner: t3[1], repo: t3[2] };
          const e3 = this.document.title.match(/([^\/\s]+)\/([^\/\s]+)/);
          return e3 ? { owner: e3[1], repo: e3[2] } : { owner: "", repo: "" };
        }
        createDescription(t3) {
          var e3;
          if (!t3)
            return "";
          const r3 = this.document.createElement("div");
          return r3.innerHTML = t3, ((e3 = r3.textContent) === null || e3 === undefined ? undefined : e3.trim().slice(0, 140).replace(/\s+/g, " ")) || "";
        }
      }
      e2.GitHubExtractor = o;
    }, 608: (t2, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.MetadataExtractor = undefined;

      class r2 {
        static extract(t3, e3, r3) {
          var n2, o;
          let i = "", s = "";
          try {
            if (s = ((n2 = t3.location) === null || n2 === undefined ? undefined : n2.href) || "", s || (s = this.getMetaContent(r3, "property", "og:url") || this.getMetaContent(r3, "property", "twitter:url") || this.getSchemaProperty(e3, "url") || this.getSchemaProperty(e3, "mainEntityOfPage.url") || this.getSchemaProperty(e3, "mainEntity.url") || this.getSchemaProperty(e3, "WebSite.url") || ((o = t3.querySelector('link[rel="canonical"]')) === null || o === undefined ? undefined : o.getAttribute("href")) || ""), s)
              try {
                i = new URL(s).hostname.replace(/^www\./, "");
              } catch (t4) {
                console.warn("Failed to parse URL:", t4);
              }
          } catch (e4) {
            const r4 = t3.querySelector("base[href]");
            if (r4)
              try {
                s = r4.getAttribute("href") || "", i = new URL(s).hostname.replace(/^www\./, "");
              } catch (t4) {
                console.warn("Failed to parse base URL:", t4);
              }
          }
          return { title: this.getTitle(t3, e3, r3), description: this.getDescription(t3, e3, r3), domain: i, favicon: this.getFavicon(t3, s, r3), image: this.getImage(t3, e3, r3), published: this.getPublished(t3, e3, r3), author: this.getAuthor(t3, e3, r3), site: this.getSite(t3, e3, r3), schemaOrgData: e3, wordCount: 0, parseTime: 0 };
        }
        static getAuthor(t3, e3, r3) {
          var n2, o, i;
          let s;
          if (s = this.getMetaContent(r3, "name", "sailthru.author") || this.getMetaContent(r3, "property", "author") || this.getMetaContent(r3, "name", "author") || this.getMetaContent(r3, "name", "byl") || this.getMetaContent(r3, "name", "authorList"), s)
            return s;
          let a = this.getMetaContents(r3, "name", "citation_author");
          if (a.length === 0 && (a = this.getMetaContents(r3, "property", "dc.creator")), a.length > 0)
            return s = a.map((t4) => {
              if (!t4.includes(","))
                return t4.trim();
              const e4 = /(.*),\s(.*)/.exec(t4);
              return e4 && e4.length === 3 ? `${e4[2]} ${e4[1]}` : t4.trim();
            }).join(", "), s;
          let l = this.getSchemaProperty(e3, "author.name") || this.getSchemaProperty(e3, "author.[].name");
          if (l) {
            const t4 = l.split(",").map((t5) => t5.trim().replace(/,$/, "").trim()).filter(Boolean);
            if (t4.length > 0) {
              let e4 = [...new Set(t4)];
              return e4.length > 10 && (e4 = e4.slice(0, 10)), e4.join(", ");
            }
          }
          const c = [];
          if (['[itemprop="author"]', ".author", '[href*="author"]', ".authors a"].forEach((e4) => {
            t3.querySelectorAll(e4).forEach((t4) => {
              var e5;
              (e5 = t4.textContent) && e5.split(",").forEach((t5) => {
                const e6 = t5.trim().replace(/,$/, "").trim(), r4 = e6.toLowerCase();
                e6 && r4 !== "author" && r4 !== "authors" && c.push(e6);
              });
            });
          }), c.length > 0) {
            let t4 = [...new Set(c.map((t5) => t5.trim()).filter(Boolean))];
            if (t4.length > 0)
              return t4.length > 10 && (t4 = t4.slice(0, 10)), t4.join(", ");
          }
          const u = t3.querySelector("h1");
          if (u) {
            let e4 = u.nextElementSibling;
            for (let t4 = 0;t4 < 3 && e4; t4++) {
              const t5 = ((n2 = e4.textContent) === null || n2 === undefined ? undefined : n2.trim()) || "";
              if (this.parseDateText(t5)) {
                const t6 = e4.querySelectorAll("a");
                for (const e5 of t6) {
                  const t7 = (((o = e5.textContent) === null || o === undefined ? undefined : o.trim()) || "").replace(/\u00a0/g, " ");
                  if (t7.length > 0 && t7.length < 100 && !this.parseDateText(t7))
                    return t7;
                }
              }
              e4 = e4.nextElementSibling;
            }
            let r4 = u.parentElement;
            for (let e5 = 0;e5 < 3 && r4 && r4 !== t3.documentElement; e5++) {
              for (const t4 of r4.querySelectorAll("p, span, address")) {
                const e6 = (((i = t4.textContent) === null || i === undefined ? undefined : i.trim()) || "").replace(/\u00a0/g, " ");
                if (e6.length > 0 && e6.length < 50) {
                  const t5 = e6.match(/^By\s+(.+)$/i);
                  if (t5)
                    return t5[1].trim();
                }
              }
              r4 = r4.parentElement;
            }
          }
          return this.getSiteName(e3, r3);
        }
        static getSiteName(t3, e3) {
          return this.getSchemaProperty(t3, "publisher.name") || this.getMetaContent(e3, "property", "og:site_name") || this.getSchemaProperty(t3, "WebSite.name") || this.getSchemaProperty(t3, "sourceOrganization.name") || this.getMetaContent(e3, "name", "copyright") || this.getSchemaProperty(t3, "copyrightHolder.name") || this.getSchemaProperty(t3, "isPartOf.name") || this.getMetaContent(e3, "name", "application-name") || "";
        }
        static getSite(t3, e3, r3) {
          return this.getSiteName(e3, r3) || this.getAuthor(t3, e3, r3) || "";
        }
        static getTitle(t3, e3, r3) {
          var n2, o;
          const i = this.getMetaContent(r3, "property", "og:title") || this.getMetaContent(r3, "name", "twitter:title") || this.getSchemaProperty(e3, "headline") || this.getMetaContent(r3, "name", "title") || this.getMetaContent(r3, "name", "sailthru.title") || ((o = (n2 = t3.querySelector("title")) === null || n2 === undefined ? undefined : n2.textContent) === null || o === undefined ? undefined : o.trim()) || "";
          return this.cleanTitle(i, this.getSite(t3, e3, r3));
        }
        static cleanTitle(t3, e3) {
          if (!t3 || !e3)
            return t3;
          const r3 = e3.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), n2 = [`\\s*[\\|\\-–—]\\s*${r3}\\s*$`, `^\\s*${r3}\\s*[\\|\\-–—]\\s*`];
          for (const e4 of n2) {
            const r4 = new RegExp(e4, "i");
            if (r4.test(t3)) {
              t3 = t3.replace(r4, "");
              break;
            }
          }
          return t3.trim();
        }
        static getDescription(t3, e3, r3) {
          return this.getMetaContent(r3, "name", "description") || this.getMetaContent(r3, "property", "description") || this.getMetaContent(r3, "property", "og:description") || this.getSchemaProperty(e3, "description") || this.getMetaContent(r3, "name", "twitter:description") || this.getMetaContent(r3, "name", "sailthru.description") || "";
        }
        static getImage(t3, e3, r3) {
          return this.getMetaContent(r3, "property", "og:image") || this.getMetaContent(r3, "name", "twitter:image") || this.getSchemaProperty(e3, "image.url") || this.getMetaContent(r3, "name", "sailthru.image.full") || "";
        }
        static getFavicon(t3, e3, r3) {
          var n2, o;
          const i = this.getMetaContent(r3, "property", "og:image:favicon");
          if (i)
            return i;
          const s = (n2 = t3.querySelector("link[rel='icon']")) === null || n2 === undefined ? undefined : n2.getAttribute("href");
          if (s)
            return s;
          const a = (o = t3.querySelector("link[rel='shortcut icon']")) === null || o === undefined ? undefined : o.getAttribute("href");
          if (a)
            return a;
          if (e3 && /^https?:\/\//.test(e3))
            try {
              return new URL("/favicon.ico", e3).href;
            } catch (t4) {}
          return "";
        }
        static getPublished(t3, e3, r3) {
          var n2, o, i;
          const s = this.getSchemaProperty(e3, "datePublished") || this.getMetaContent(r3, "name", "publishDate") || this.getMetaContent(r3, "property", "article:published_time") || ((o = (n2 = t3.querySelector('abbr[itemprop="datePublished"]')) === null || n2 === undefined ? undefined : n2.title) === null || o === undefined ? undefined : o.trim()) || this.getTimeElement(t3) || this.getMetaContent(r3, "name", "sailthru.date");
          if (s)
            return s;
          const a = t3.querySelector("h1");
          if (a) {
            let t4 = a.nextElementSibling;
            for (let e4 = 0;e4 < 3 && t4; e4++) {
              const e5 = this.parseDateText(((i = t4.textContent) === null || i === undefined ? undefined : i.trim()) || "");
              if (e5)
                return e5;
              t4 = t4.nextElementSibling;
            }
          }
          return "";
        }
        static getMetaContent(t3, e3, r3) {
          var n2;
          return (n2 = this.getMetaContents(t3, e3, r3)[0]) !== null && n2 !== undefined ? n2 : "";
        }
        static getMetaContents(t3, e3, r3) {
          return t3.filter((t4) => {
            const n2 = e3 === "name" ? t4.name : t4.property;
            return (n2 == null ? undefined : n2.toLowerCase()) === r3.toLowerCase();
          }).map((t4) => {
            var e4, r4;
            return (r4 = (e4 = t4.content) === null || e4 === undefined ? undefined : e4.trim()) !== null && r4 !== undefined ? r4 : "";
          });
        }
        static getTimeElement(t3) {
          var e3, r3, n2, o;
          const i = Array.from(t3.querySelectorAll("time"))[0];
          return i && (o = (r3 = (e3 = i.getAttribute("datetime")) === null || e3 === undefined ? undefined : e3.trim()) !== null && r3 !== undefined ? r3 : (n2 = i.textContent) === null || n2 === undefined ? undefined : n2.trim()) !== null && o !== undefined ? o : "";
        }
        static parseDateText(t3) {
          let e3 = t3.match(/\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
          if (e3) {
            const t4 = e3[1].padStart(2, "0"), r3 = this.MONTH_MAP[e3[2].toLowerCase()];
            return `${e3[3]}-${r3}-${t4}T00:00:00+00:00`;
          }
          if (e3 = t3.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i), e3) {
            const t4 = this.MONTH_MAP[e3[1].toLowerCase()], r3 = e3[2].padStart(2, "0");
            return `${e3[3]}-${t4}-${r3}T00:00:00+00:00`;
          }
          return "";
        }
        static getSchemaProperty(t3, e3, r3 = "") {
          if (!t3)
            return r3;
          const n2 = (t4, e4, r4, o = true) => {
            if (typeof t4 == "string")
              return e4.length === 0 ? [t4] : [];
            if (!t4 || typeof t4 != "object")
              return [];
            if (Array.isArray(t4)) {
              const i2 = e4[0];
              if (/^\[\d+\]$/.test(i2)) {
                const s2 = parseInt(i2.slice(1, -1));
                return t4[s2] ? n2(t4[s2], e4.slice(1), r4, o) : [];
              }
              return e4.length === 0 && t4.every((t5) => typeof t5 == "string" || typeof t5 == "number") ? t4.map(String) : t4.flatMap((t5) => n2(t5, e4, r4, o));
            }
            const [i, ...s] = e4;
            if (!i)
              return typeof t4 == "string" ? [t4] : typeof t4 == "object" && t4.name ? [t4.name] : [];
            if (t4.hasOwnProperty(i))
              return n2(t4[i], s, r4 ? `${r4}.${i}` : i, true);
            if (!o) {
              const o2 = [];
              for (const i2 in t4)
                if (typeof t4[i2] == "object") {
                  const s2 = n2(t4[i2], e4, r4 ? `${r4}.${i2}` : i2, false);
                  o2.push(...s2);
                }
              if (o2.length > 0)
                return o2;
            }
            return [];
          };
          try {
            let o = n2(t3, e3.split("."), "", true);
            o.length === 0 && (o = n2(t3, e3.split("."), "", false));
            return o.length > 0 ? o.filter(Boolean).join(", ") : r3;
          } catch (t4) {
            return console.error(`Error in getSchemaProperty for ${e3}:`, t4), r3;
          }
        }
      }
      e2.MetadataExtractor = r2, r2.MONTH_MAP = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
    }, 610: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.standardizeFootnotes = function(t3) {
        const e3 = t3.ownerDocument;
        if (!e3)
          return void console.warn("standardizeFootnotes: No document available");
        new o(e3).standardizeFootnotes(t3);
      };
      const n2 = r2(640);

      class o {
        constructor(t3) {
          this.genericContainer = null, this.doc = t3;
        }
        createFootnoteItem(t3, e3, r3) {
          const n3 = typeof e3 == "string" ? this.doc : e3.ownerDocument, o2 = n3.createElement("li");
          if (o2.className = "footnote", o2.id = `fn:${t3}`, typeof e3 == "string") {
            const t4 = n3.createElement("p");
            t4.innerHTML = e3, o2.appendChild(t4);
          } else {
            const t4 = Array.from(e3.querySelectorAll("p"));
            if (t4.length === 0) {
              const t5 = n3.createElement("p");
              t5.innerHTML = e3.innerHTML, this.removeBackrefs(t5), o2.appendChild(t5);
            } else
              t4.forEach((t5) => {
                const e4 = n3.createElement("p");
                e4.innerHTML = t5.innerHTML, this.removeBackrefs(e4), o2.appendChild(e4);
              });
          }
          const i = o2.querySelector("p:last-of-type") || o2;
          return r3.forEach((t4, e4) => {
            const o3 = n3.createElement("a");
            o3.href = `#${t4}`, o3.title = "return to article", o3.className = "footnote-backref", o3.innerHTML = "↩", e4 < r3.length - 1 && (o3.innerHTML += " "), i.appendChild(o3);
          }), o2;
        }
        collectFootnotes(t3) {
          const e3 = {};
          let r3 = 1;
          const o2 = new Set;
          if (t3.querySelectorAll(n2.FOOTNOTE_LIST_SELECTORS).forEach((n3) => {
            if (n3.matches("div.footnotes-footer")) {
              return void n3.querySelectorAll("div.footnote-footer").forEach((n4) => {
                const i = (n4.id || "").match(/^footnote-(\d+)$/);
                if (i) {
                  const s = i[1];
                  if (!o2.has(s)) {
                    const i2 = n4.cloneNode(true), a = i2.querySelector("a");
                    a && a.remove();
                    let l = i2.innerHTML || "";
                    l = l.replace(/^\s*\.\s*/, "");
                    const c = t3.ownerDocument.createElement("div");
                    c.innerHTML = l.trim(), e3[r3] = { content: c, originalId: s, refs: [] }, o2.add(s), r3++;
                  }
                }
              });
            }
            if (n3.matches('div.footnote[data-component-name="FootnoteToDOM"]')) {
              const t4 = n3.querySelector("a.footnote-number"), i = n3.querySelector(".footnote-content");
              if (t4 && i) {
                const n4 = t4.id.replace("footnote-", "").toLowerCase();
                n4 && !o2.has(n4) && (e3[r3] = { content: i, originalId: n4, refs: [] }, o2.add(n4), r3++);
              }
              return;
            }
            n3.querySelectorAll('li, div[role="listitem"]').forEach((t4) => {
              var n4, i, s, a;
              let l = "", c = null;
              const u = t4.querySelector(".citations");
              if ((n4 = u == null ? undefined : u.id) === null || n4 === undefined ? undefined : n4.toLowerCase().startsWith("r")) {
                l = u.id.toLowerCase();
                const t5 = u.querySelector(".citation-content");
                t5 && (c = t5);
              } else {
                if (t4.id.toLowerCase().startsWith("bib.bib"))
                  l = t4.id.replace("bib.bib", "").toLowerCase();
                else if (t4.id.toLowerCase().startsWith("fn:"))
                  l = t4.id.replace("fn:", "").toLowerCase();
                else if (t4.id.toLowerCase().startsWith("fn"))
                  l = t4.id.replace("fn", "").toLowerCase();
                else if (t4.hasAttribute("data-counter"))
                  l = ((s = (i = t4.getAttribute("data-counter")) === null || i === undefined ? undefined : i.replace(/\.$/, "")) === null || s === undefined ? undefined : s.toLowerCase()) || "";
                else {
                  const e4 = (a = t4.id.split("/").pop()) === null || a === undefined ? undefined : a.match(/cite_note-(.+)/);
                  l = e4 ? e4[1].toLowerCase() : t4.id.toLowerCase();
                }
                c = t4;
              }
              l && !o2.has(l) && (e3[r3] = { content: c || t4, originalId: l, refs: [] }, o2.add(l), r3++);
            });
          }), r3 === 1) {
            const n3 = new Map;
            if (t3.querySelectorAll('a[href*="#"]').forEach((t4) => {
              var e4, r4;
              const o3 = (e4 = (t4.getAttribute("href") || "").split("#").pop()) === null || e4 === undefined ? undefined : e4.toLowerCase();
              if (!o3)
                return;
              const i = ((r4 = t4.textContent) === null || r4 === undefined ? undefined : r4.trim()) || "";
              if (!/^\[?\(?\d{1,4}\)?\]?$/.test(i))
                return;
              const s = t4.parentElement;
              if (!s)
                return;
              const a = s.tagName.toLowerCase();
              a !== "sup" && a !== "span" && t4.tagName.toLowerCase() !== "a" || (n3.has(o3) || n3.set(o3, []), n3.get(o3).push(t4));
            }), n3.size >= 2) {
              const i = new Set(n3.keys()), s = t3.querySelectorAll("div, section, aside, footer");
              let a = null, l = 0;
              if (s.forEach((e4) => {
                if (e4 === t3)
                  return;
                const r4 = e4.querySelectorAll("p[id], li[id], div[id]");
                let n4 = 0;
                r4.forEach((t4) => {
                  i.has(t4.id.toLowerCase()) && n4++;
                }), n4 >= 2 && n4 >= l && (l = n4, a = e4);
              }), a) {
                const n4 = a.querySelectorAll("p[id], li[id], div[id]"), s2 = [];
                n4.forEach((t4) => {
                  i.has(t4.id.toLowerCase()) && s2.push(t4);
                }), s2.forEach((n5) => {
                  const i2 = n5.id.toLowerCase();
                  if (o2.has(i2))
                    return;
                  const s3 = t3.ownerDocument.createElement("div"), a2 = n5.cloneNode(true), l2 = a2.childNodes[0];
                  l2 && l2.nodeType === 3 && (l2.textContent = l2.textContent.replace(/^\d+\.\s*/, "")), s3.appendChild(a2);
                  let c = n5.nextElementSibling;
                  for (;c && !c.id; ) {
                    const t4 = c.cloneNode(true);
                    s3.appendChild(t4), c = c.nextElementSibling;
                  }
                  e3[r3] = { content: s3, originalId: i2, refs: [] }, o2.add(i2), r3++;
                }), this.genericContainer = a;
              }
            }
          }
          return e3;
        }
        removeBackrefs(t3) {
          for (t3.querySelectorAll("a").forEach((t4) => {
            var e3, r3;
            (((e3 = t4.textContent) === null || e3 === undefined ? undefined : e3.trim()) === "↩" || ((r3 = t4.classList) === null || r3 === undefined ? undefined : r3.contains("footnote-backref"))) && t4.remove();
          });t3.lastChild && t3.lastChild.nodeType === 3; ) {
            const e3 = t3.lastChild.textContent;
            if (!/^[\s,.;]*$/.test(e3))
              break;
            t3.lastChild.remove();
          }
        }
        findOuterFootnoteContainer(t3) {
          let e3 = t3, r3 = t3.parentElement;
          for (;r3 && (r3.tagName.toLowerCase() === "span" || r3.tagName.toLowerCase() === "sup"); )
            e3 = r3, r3 = r3.parentElement;
          return e3;
        }
        createFootnoteReference(t3, e3) {
          const r3 = this.doc.createElement("sup");
          r3.id = e3;
          const n3 = this.doc.createElement("a");
          return n3.href = `#fn:${t3}`, n3.textContent = t3, r3.appendChild(n3), r3;
        }
        standardizeFootnotes(t3) {
          const e3 = this.collectFootnotes(t3), r3 = t3.querySelectorAll(n2.FOOTNOTE_INLINE_REFERENCES), o2 = new Map;
          r3.forEach((t4) => {
            var r4, n3, i2, s2, a2;
            if (!t4 || !t4.parentNode)
              return;
            let l = "", c = "";
            if (t4.matches("sup.footnoteref")) {
              const e4 = t4.querySelector('a[id^="footnoteref-"]');
              if (e4) {
                const t5 = (e4.id || "").match(/^footnoteref-(\d+)$/);
                t5 && (l = t5[1]);
              }
            } else if (t4.matches('a[id^="ref-link"]'))
              l = ((r4 = t4.textContent) === null || r4 === undefined ? undefined : r4.trim()) || "";
            else if (t4.matches('a[role="doc-biblioref"]')) {
              const e4 = t4.getAttribute("data-xml-rid");
              if (e4)
                l = e4;
              else {
                const e5 = t4.getAttribute("href");
                (e5 == null ? undefined : e5.startsWith("#core-R")) && (l = e5.replace("#core-", ""));
              }
            } else if (t4.matches("a.footnote-anchor, span.footnote-hovercard-target a")) {
              const e4 = ((n3 = t4.id) === null || n3 === undefined ? undefined : n3.replace("footnote-anchor-", "")) || "";
              e4 && (l = e4.toLowerCase());
            } else if (t4.matches("cite.ltx_cite")) {
              const e4 = t4.querySelector("a");
              if (e4) {
                const t5 = e4.getAttribute("href");
                if (t5) {
                  const e5 = (i2 = t5.split("/").pop()) === null || i2 === undefined ? undefined : i2.match(/bib\.bib(\d+)/);
                  e5 && (l = e5[1].toLowerCase());
                }
              }
            } else if (t4.matches("sup.reference")) {
              const e4 = t4.querySelectorAll("a");
              Array.from(e4).forEach((t5) => {
                var e5;
                const r5 = t5.getAttribute("href");
                if (r5) {
                  const t6 = (e5 = r5.split("/").pop()) === null || e5 === undefined ? undefined : e5.match(/(?:cite_note|cite_ref)-(.+)/);
                  t6 && (l = t6[1].toLowerCase());
                }
              });
            } else if (t4.matches('sup[id^="fnref:"]'))
              l = t4.id.replace("fnref:", "").toLowerCase();
            else if (t4.matches('sup[id^="fnr"]'))
              l = t4.id.replace("fnr", "").toLowerCase();
            else if (t4.matches("span.footnote-reference"))
              l = t4.getAttribute("data-footnote-id") || "", !l && ((s2 = t4.id) === null || s2 === undefined ? undefined : s2.startsWith("fnref")) && (l = t4.id.replace("fnref", "").toLowerCase());
            else if (t4.matches("span.footnote-link"))
              l = t4.getAttribute("data-footnote-id") || "", c = t4.getAttribute("data-footnote-content") || "";
            else if (t4.matches("a.citation"))
              l = ((a2 = t4.textContent) === null || a2 === undefined ? undefined : a2.trim()) || "", c = t4.getAttribute("href") || "";
            else if (t4.matches('a[id^="fnref"]'))
              l = t4.id.replace("fnref", "").toLowerCase();
            else {
              const e4 = t4.getAttribute("href");
              if (e4) {
                const t5 = e4.replace(/^[#]/, "");
                l = t5.toLowerCase();
              }
            }
            if (l) {
              const r5 = Object.entries(e3).find(([t5, e4]) => e4.originalId === l.toLowerCase());
              if (r5) {
                const [e4, n4] = r5, i3 = n4.refs.length > 0 ? `fnref:${e4}-${n4.refs.length + 1}` : `fnref:${e4}`;
                n4.refs.push(i3);
                const s3 = this.findOuterFootnoteContainer(t4);
                if (s3.tagName.toLowerCase() === "sup") {
                  o2.has(s3) || o2.set(s3, []);
                  o2.get(s3).push(this.createFootnoteReference(e4, i3));
                } else
                  s3.replaceWith(this.createFootnoteReference(e4, i3));
              }
            }
          });
          const i = Object.entries(e3).filter(([t4, e4]) => e4.refs.length === 0);
          if (i.length > 0) {
            const r4 = new Map, n3 = new Map;
            i.forEach(([t4, e4]) => {
              r4.set(e4.originalId, [t4, e4]), n3.set(t4, [t4, e4]);
            });
            t3.querySelectorAll('a[href*="#"]').forEach((t4) => {
              var e4, n4;
              if (!t4.parentNode)
                return;
              if (t4.closest('[id^="fnref:"]'))
                return;
              if (t4.closest("#footnotes"))
                return;
              if (this.genericContainer && this.genericContainer.contains(t4))
                return;
              const o3 = (e4 = (t4.getAttribute("href") || "").split("#").pop()) === null || e4 === undefined ? undefined : e4.toLowerCase();
              if (!o3)
                return;
              const i2 = r4.get(o3);
              if (!i2)
                return;
              const s2 = ((n4 = t4.textContent) === null || n4 === undefined ? undefined : n4.trim()) || "";
              if (!/^[\[\(]?\d{1,4}[\]\)]?$/.test(s2))
                return;
              const [a2, l] = i2, c = l.refs.length > 0 ? `fnref:${a2}-${l.refs.length + 1}` : `fnref:${a2}`;
              l.refs.push(c);
              this.findOuterFootnoteContainer(t4).replaceWith(this.createFootnoteReference(a2, c));
            });
            if (Object.entries(e3).filter(([t4, e4]) => e4.refs.length === 0).length > 0) {
              t3.querySelectorAll("sup, span.footnote-ref").forEach((t4) => {
                var e4, o3;
                if (!t4.parentNode)
                  return;
                if ((e4 = t4.id) === null || e4 === undefined ? undefined : e4.startsWith("fnref:"))
                  return;
                if (t4.closest("#footnotes"))
                  return;
                const i2 = (((o3 = t4.textContent) === null || o3 === undefined ? undefined : o3.trim()) || "").match(/^[\[\(]?(\d{1,4})[\]\)]?$/);
                if (!i2)
                  return;
                const s2 = i2[1], a2 = n3.get(s2) || r4.get(s2);
                if (!a2)
                  return;
                const [l, c] = a2;
                if (c.refs.length > 0)
                  return;
                const u = `fnref:${l}`;
                c.refs.push(u);
                this.findOuterFootnoteContainer(t4).replaceWith(this.createFootnoteReference(l, u));
              });
            }
          }
          o2.forEach((t4, e4) => {
            if (t4.length > 0) {
              const r4 = this.doc.createDocumentFragment();
              t4.forEach((t5) => {
                const e5 = t5.querySelector("a");
                if (e5) {
                  const n3 = this.doc.createElement("sup");
                  n3.id = t5.id, n3.appendChild(e5.cloneNode(true)), r4.appendChild(n3);
                }
              }), e4.replaceWith(r4);
            }
          });
          const s = this.doc.createElement("div");
          s.id = "footnotes";
          const a = this.doc.createElement("ol");
          Object.entries(e3).forEach(([t4, e4]) => {
            const r4 = this.createFootnoteItem(parseInt(t4), e4.content, e4.refs);
            a.appendChild(r4);
          });
          t3.querySelectorAll(n2.FOOTNOTE_LIST_SELECTORS).forEach((t4) => t4.remove()), this.genericContainer && this.genericContainer.parentNode && this.genericContainer.remove(), a.children.length > 0 && (s.appendChild(a), t3.appendChild(s));
        }
      }
    }, 628: function(t2, e2, r2) {
      var n2 = this && this.__awaiter || function(t3, e3, r3, n3) {
        return new (r3 || (r3 = Promise))(function(o2, i2) {
          function s2(t4) {
            try {
              l2(n3.next(t4));
            } catch (t5) {
              i2(t5);
            }
          }
          function a2(t4) {
            try {
              l2(n3.throw(t4));
            } catch (t5) {
              i2(t5);
            }
          }
          function l2(t4) {
            var e4;
            t4.done ? o2(t4.value) : (e4 = t4.value, e4 instanceof r3 ? e4 : new r3(function(t5) {
              t5(e4);
            })).then(s2, a2);
          }
          l2((n3 = n3.apply(t3, e3 || [])).next());
        });
      };
      Object.defineProperty(e2, "__esModule", { value: true }), e2.Defuddle = undefined;
      const o = r2(608), i = r2(917), s = r2(640), a = r2(840), l = r2(968), c = r2(552);
      e2.Defuddle = class {
        constructor(t3, e3 = {}) {
          this.doc = t3, this.options = e3, this.debug = e3.debug || false;
        }
        parse() {
          let t3 = this.parseInternal();
          if (t3.wordCount < 200) {
            this._log("Initial parse returned very little content, trying again");
            const e4 = this.parseInternal({ removePartialSelectors: false });
            e4.wordCount > t3.wordCount && (this._log("Retry produced more content"), t3 = e4);
          }
          this._stripUnsafeElements();
          const e3 = this._getSchemaText(t3.schemaOrgData);
          if (e3 && this.countWords(e3) > t3.wordCount) {
            const r3 = this._findContentBySchemaText(e3);
            r3 ? (this._log("Found DOM content matching schema.org text"), t3.content = r3, t3.wordCount = this.countWords(r3)) : (this._log("Using schema.org text as content (DOM element not found)"), t3.content = e3, t3.wordCount = this.countWords(e3));
          }
          return t3;
        }
        _getSchemaText(t3) {
          if (!t3)
            return "";
          const e3 = Array.isArray(t3) ? t3 : [t3];
          for (const t4 of e3) {
            if (t4 == null ? undefined : t4.text)
              return t4.text;
            if (t4 == null ? undefined : t4.articleBody)
              return t4.articleBody;
          }
          return "";
        }
        _stripUnsafeElements() {
          const t3 = this.doc.body;
          if (!t3)
            return;
          const e3 = t3.querySelectorAll('script:not([type^="math/"]), style, noscript, frame, frameset, object, embed, applet, base');
          for (const t4 of e3)
            t4.remove();
          const r3 = t3.querySelectorAll("*");
          for (const t4 of r3)
            for (const e4 of Array.from(t4.attributes)) {
              const r4 = e4.name.toLowerCase();
              if (r4.startsWith("on"))
                t4.removeAttribute(e4.name);
              else if (r4 === "srcdoc")
                t4.removeAttribute(e4.name);
              else if (["href", "src", "action", "formaction", "xlink:href"].includes(r4)) {
                const r5 = e4.value.replace(/[\s\u0000-\u001F]+/g, "").toLowerCase();
                (r5.startsWith("javascript:") || r5.startsWith("data:text/html")) && t4.removeAttribute(e4.name);
              }
            }
        }
        _findContentBySchemaText(t3) {
          var e3;
          const r3 = this.doc.body;
          if (!r3)
            return "";
          const n3 = (((e3 = t3.split(/\n\s*\n/)[0]) === null || e3 === undefined ? undefined : e3.trim()) || "").substring(0, 100).trim();
          if (!n3)
            return "";
          const o2 = this.countWords(t3);
          let i2 = null, s2 = 1 / 0;
          const a2 = r3.querySelectorAll("*");
          for (const t4 of a2) {
            const e4 = t4.textContent || "";
            if (!e4.includes(n3))
              continue;
            const r4 = e4.trim().split(/\s+/).length;
            r4 >= 0.8 * o2 && r4 < s2 && (s2 = r4, i2 = t4);
          }
          if (!i2)
            return "";
          let l2 = "", c2 = "";
          const u = i2.parentElement;
          if (u && u !== r3) {
            const t4 = u.querySelectorAll("img");
            let e4 = null, r4 = 0;
            for (const n4 of t4) {
              if (i2.contains(n4))
                continue;
              const t5 = parseInt(n4.getAttribute("width") || "0", 10) * parseInt(n4.getAttribute("height") || "0", 10);
              t5 > r4 && (r4 = t5, e4 = n4);
            }
            if (e4) {
              l2 = this._getLargestImageSrc(e4), c2 = e4.getAttribute("alt") || "";
              try {
                const t5 = this.options.url || this.doc.URL;
                t5 && (l2 = new URL(l2, t5).href);
              } catch (t5) {}
            }
          }
          this.resolveRelativeUrls(i2);
          let d = i2.innerHTML;
          if (l2) {
            const t4 = this.doc.createElement("img");
            t4.setAttribute("src", l2), t4.setAttribute("alt", c2), d += t4.outerHTML;
          }
          return d;
        }
        _getLargestImageSrc(t3) {
          const e3 = t3.getAttribute("srcset") || "";
          if (!e3)
            return t3.getAttribute("src") || "";
          const r3 = /(.+?)\s+(\d+(?:\.\d+)?)w/g;
          let n3, o2 = "", i2 = 0, s2 = 0;
          for (;(n3 = r3.exec(e3)) !== null; ) {
            let t4 = n3[1].trim();
            s2 > 0 && (t4 = t4.replace(/^,\s*/, "")), s2 = r3.lastIndex;
            const e4 = parseFloat(n3[2]);
            t4 && e4 > i2 && (i2 = e4, o2 = t4);
          }
          let a2 = o2 || t3.getAttribute("src") || "";
          return a2 = a2.replace(/,w_\d+/g, "").replace(/,c_\w+/g, ""), a2;
        }
        parseAsync() {
          return n2(this, undefined, undefined, function* () {
            var t3, e3, r3, n3;
            const s2 = this.parse();
            if (s2.wordCount > 0 || this.options.useAsync === false)
              return s2;
            try {
              const s3 = this.options.url || this.doc.URL, a2 = this._extractSchemaOrgData(this.doc), l2 = i.ExtractorRegistry.findAsyncExtractor(this.doc, s3, a2);
              if (l2) {
                const i2 = Date.now(), s4 = yield l2.extractAsync(), c2 = this.resolveContentUrls(s4.contentHtml), u = this._collectMetaTags(), d = o.MetadataExtractor.extract(this.doc, a2, u), m = Date.now();
                return { content: c2, title: ((t3 = s4.variables) === null || t3 === undefined ? undefined : t3.title) || d.title, description: d.description, domain: d.domain, favicon: d.favicon, image: d.image, published: ((e3 = s4.variables) === null || e3 === undefined ? undefined : e3.published) || d.published, author: ((r3 = s4.variables) === null || r3 === undefined ? undefined : r3.author) || d.author, site: ((n3 = s4.variables) === null || n3 === undefined ? undefined : n3.site) || d.site, schemaOrgData: d.schemaOrgData, wordCount: this.countWords(s4.contentHtml), parseTime: Math.round(m - i2), extractorType: l2.constructor.name.replace("Extractor", "").toLowerCase(), metaTags: u };
              }
            } catch (t4) {
              console.error("Defuddle", "Error in async extraction:", t4);
            }
            return s2;
          });
        }
        parseInternal(t3 = {}) {
          var e3, r3, n3, s2;
          const c2 = Date.now(), u = Object.assign(Object.assign({ removeExactSelectors: true, removePartialSelectors: true }, this.options), t3), d = this._extractSchemaOrgData(this.doc), m = this._collectMetaTags(), h = o.MetadataExtractor.extract(this.doc, d, m);
          u.removeImages && this.removeImages(this.doc);
          try {
            const t4 = u.url || this.doc.URL, o2 = i.ExtractorRegistry.findExtractor(this.doc, t4, d);
            if (o2 && o2.canExtract()) {
              const t5 = o2.extract(), i2 = this.resolveContentUrls(t5.contentHtml), a2 = Date.now();
              return { content: i2, title: ((e3 = t5.variables) === null || e3 === undefined ? undefined : e3.title) || h.title, description: h.description, domain: h.domain, favicon: h.favicon, image: h.image, published: ((r3 = t5.variables) === null || r3 === undefined ? undefined : r3.published) || h.published, author: ((n3 = t5.variables) === null || n3 === undefined ? undefined : n3.author) || h.author, site: ((s2 = t5.variables) === null || s2 === undefined ? undefined : s2.site) || h.site, schemaOrgData: h.schemaOrgData, wordCount: this.countWords(t5.contentHtml), parseTime: Math.round(a2 - c2), extractorType: o2.constructor.name.replace("Extractor", "").toLowerCase(), metaTags: m };
            }
            const f = this._evaluateMediaQueries(this.doc), p = this.findSmallImages(this.doc), g = this.doc.cloneNode(true);
            this.applyMobileStyles(g, f);
            const v = this.findMainContent(g);
            if (!v) {
              const t5 = this.resolveContentUrls(this.doc.body.innerHTML), e4 = Date.now();
              return Object.assign(Object.assign({ content: t5 }, h), { wordCount: this.countWords(t5), parseTime: Math.round(e4 - c2), metaTags: m });
            }
            this.removeSmallImages(g, p), this.removeHiddenElements(g), l.ContentScorer.scoreAndRemove(g, this.debug), (u.removeExactSelectors || u.removePartialSelectors) && this.removeBySelector(g, u.removeExactSelectors, u.removePartialSelectors, v), (0, a.standardizeContent)(v, h, this.doc, this.debug), this.resolveRelativeUrls(v);
            const y = v.outerHTML, b = Date.now();
            return Object.assign(Object.assign({ content: y }, h), { wordCount: this.countWords(y), parseTime: Math.round(b - c2), metaTags: m });
          } catch (t4) {
            console.error("Defuddle", "Error processing document:", t4);
            const e4 = this.resolveContentUrls(this.doc.body.innerHTML), r4 = Date.now();
            return Object.assign(Object.assign({ content: e4 }, h), { wordCount: this.countWords(e4), parseTime: Math.round(r4 - c2), metaTags: m });
          }
        }
        countWords(t3) {
          const e3 = this.doc.createElement("div");
          e3.innerHTML = t3;
          return (e3.textContent || "").trim().replace(/\s+/g, " ").split(" ").filter((t4) => t4.length > 0).length;
        }
        _log(...t3) {
          this.debug && console.log("Defuddle:", ...t3);
        }
        _evaluateMediaQueries(t3) {
          const e3 = [], r3 = /max-width[^:]*:\s*(\d+)/;
          try {
            const n3 = Array.from(t3.styleSheets).filter((t4) => {
              try {
                return t4.cssRules, true;
              } catch (t5) {
                return t5 instanceof DOMException && t5.name, false;
              }
            });
            n3.flatMap((t4) => {
              try {
                return typeof CSSMediaRule == "undefined" ? [] : Array.from(t4.cssRules).filter((t5) => t5 instanceof CSSMediaRule && t5.conditionText.includes("max-width"));
              } catch (t5) {
                return this.debug && console.warn("Defuddle: Failed to process stylesheet:", t5), [];
              }
            }).forEach((t4) => {
              const n4 = t4.conditionText.match(r3);
              if (n4) {
                const r4 = parseInt(n4[1]);
                if (s.MOBILE_WIDTH <= r4) {
                  Array.from(t4.cssRules).filter((t5) => t5 instanceof CSSStyleRule).forEach((t5) => {
                    try {
                      e3.push({ selector: t5.selectorText, styles: t5.style.cssText });
                    } catch (t6) {
                      this.debug && console.warn("Defuddle: Failed to process CSS rule:", t6);
                    }
                  });
                }
              }
            });
          } catch (t4) {
            console.error("Defuddle: Error evaluating media queries:", t4);
          }
          return e3;
        }
        applyMobileStyles(t3, e3) {
          e3.forEach(({ selector: e4, styles: r3 }) => {
            try {
              t3.querySelectorAll(e4).forEach((t4) => {
                t4.setAttribute("style", (t4.getAttribute("style") || "") + r3);
              });
            } catch (t4) {
              console.error("Defuddle", "Error applying styles for selector:", e4, t4);
            }
          });
        }
        removeImages(t3) {
          const e3 = t3.getElementsByTagName("img");
          Array.from(e3).forEach((t4) => {
            t4.remove();
          });
        }
        removeHiddenElements(t3) {
          let e3 = 0;
          const r3 = new Set, n3 = Array.from(t3.getElementsByTagName("*"));
          for (let o2 = 0;o2 < n3.length; o2 += 100) {
            const i2 = n3.slice(o2, o2 + 100), s2 = i2.map((e4) => {
              var r4, n4;
              try {
                return (r4 = e4.ownerDocument.defaultView) === null || r4 === undefined ? undefined : r4.getComputedStyle(e4);
              } catch (r5) {
                const o3 = e4.getAttribute("style");
                if (!o3)
                  return null;
                const i3 = t3.createElement("style");
                i3.textContent = `* { ${o3} }`, t3.head.appendChild(i3);
                const s3 = (n4 = e4.ownerDocument.defaultView) === null || n4 === undefined ? undefined : n4.getComputedStyle(e4);
                return t3.head.removeChild(i3), s3;
              }
            });
            i2.forEach((t4, n4) => {
              const o3 = s2[n4];
              !o3 || o3.display !== "none" && o3.visibility !== "hidden" && o3.opacity !== "0" || (r3.add(t4), e3++);
            });
          }
          r3.forEach((t4) => t4.remove()), this._log("Removed hidden elements:", e3);
        }
        removeBySelector(t3, e3 = true, r3 = true, n3) {
          const o2 = Date.now();
          let i2 = 0, a2 = 0;
          const l2 = new Set;
          if (e3) {
            t3.querySelectorAll(s.EXACT_SELECTORS.join(",")).forEach((t4) => {
              (t4 == null ? undefined : t4.parentNode) && (l2.add(t4), i2++);
            });
          }
          if (r3) {
            const e4 = s.PARTIAL_SELECTORS.join("|"), r4 = new RegExp(e4, "i"), n4 = s.TEST_ATTRIBUTES.map((t4) => `[${t4}]`).join(",");
            t3.querySelectorAll(n4).forEach((t4) => {
              if (l2.has(t4))
                return;
              const e5 = t4.tagName;
              if (e5 === "CODE" || e5 === "PRE" || t4.querySelector("pre"))
                return;
              const n5 = s.TEST_ATTRIBUTES.map((e6) => e6 === "class" ? t4.className && typeof t4.className == "string" ? t4.className : "" : e6 === "id" ? t4.id || "" : t4.getAttribute(e6) || "").join(" ").toLowerCase();
              n5.trim() && r4.test(n5) && (l2.add(t4), a2++);
            });
          }
          l2.forEach((t4) => {
            if (!(n3 && t4.contains(n3) || t4.tagName === "A" && t4.closest("h1, h2, h3, h4, h5, h6"))) {
              try {
                if (t4.matches(s.FOOTNOTE_LIST_SELECTORS) || t4.querySelector(s.FOOTNOTE_LIST_SELECTORS))
                  return;
                const e4 = t4.parentElement;
                if (e4 && e4.matches(s.FOOTNOTE_LIST_SELECTORS))
                  return;
              } catch (t5) {}
              t4.remove();
            }
          });
          const c2 = Date.now();
          this._log("Removed clutter elements:", { exactSelectors: i2, partialSelectors: a2, total: l2.size, processingTime: `${(c2 - o2).toFixed(2)}ms` });
        }
        findSmallImages(t3) {
          const e3 = new Set, r3 = /scale\(([\d.]+)\)/, n3 = Date.now();
          let o2 = 0;
          const i2 = [...Array.from(t3.getElementsByTagName("img")), ...Array.from(t3.getElementsByTagName("svg"))];
          if (i2.length === 0)
            return e3;
          const s2 = i2.map((t4) => ({ element: t4, naturalWidth: t4.tagName.toLowerCase() === "img" && parseInt(t4.getAttribute("width") || "0") || 0, naturalHeight: t4.tagName.toLowerCase() === "img" && parseInt(t4.getAttribute("height") || "0") || 0, attrWidth: parseInt(t4.getAttribute("width") || "0"), attrHeight: parseInt(t4.getAttribute("height") || "0") }));
          for (let t4 = 0;t4 < s2.length; t4 += 50) {
            const n4 = s2.slice(t4, t4 + 50);
            try {
              const t5 = n4.map(({ element: t6 }) => {
                var e4;
                try {
                  return (e4 = t6.ownerDocument.defaultView) === null || e4 === undefined ? undefined : e4.getComputedStyle(t6);
                } catch (t7) {
                  return null;
                }
              }), i3 = n4.map(({ element: t6 }) => {
                try {
                  return t6.getBoundingClientRect();
                } catch (t7) {
                  return null;
                }
              });
              n4.forEach((n5, s3) => {
                var a3;
                try {
                  const l2 = t5[s3], c2 = i3[s3];
                  if (!l2)
                    return;
                  const u = l2.transform, d = u ? parseFloat(((a3 = u.match(r3)) === null || a3 === undefined ? undefined : a3[1]) || "1") : 1, m = [n5.naturalWidth, n5.attrWidth, parseInt(l2.width) || 0, c2 ? c2.width * d : 0].filter((t6) => typeof t6 == "number" && t6 > 0), h = [n5.naturalHeight, n5.attrHeight, parseInt(l2.height) || 0, c2 ? c2.height * d : 0].filter((t6) => typeof t6 == "number" && t6 > 0);
                  if (m.length > 0 && h.length > 0) {
                    const t6 = Math.min(...m), r4 = Math.min(...h);
                    if (t6 < 33 || r4 < 33) {
                      const t7 = this.getElementIdentifier(n5.element);
                      t7 && (e3.add(t7), o2++);
                    }
                  }
                } catch (t6) {
                  this.debug && console.warn("Defuddle: Failed to process element dimensions:", t6);
                }
              });
            } catch (t5) {
              this.debug && console.warn("Defuddle: Failed to process batch:", t5);
            }
          }
          const a2 = Date.now();
          return this._log("Found small elements:", { count: o2, processingTime: `${(a2 - n3).toFixed(2)}ms` }), e3;
        }
        removeSmallImages(t3, e3) {
          let r3 = 0;
          ["img", "svg"].forEach((n3) => {
            const o2 = t3.getElementsByTagName(n3);
            Array.from(o2).forEach((t4) => {
              const n4 = this.getElementIdentifier(t4);
              n4 && e3.has(n4) && (t4.remove(), r3++);
            });
          }), this._log("Removed small elements:", r3);
        }
        getElementIdentifier(t3) {
          if (t3.tagName.toLowerCase() === "img") {
            const e4 = t3.getAttribute("data-src");
            if (e4)
              return `src:${e4}`;
            const r4 = t3.getAttribute("src") || "", n4 = t3.getAttribute("srcset") || "", o2 = t3.getAttribute("data-srcset");
            if (r4)
              return `src:${r4}`;
            if (n4)
              return `srcset:${n4}`;
            if (o2)
              return `srcset:${o2}`;
          }
          const e3 = t3.id || "", r3 = t3.className || "", n3 = t3.tagName.toLowerCase() === "svg" && t3.getAttribute("viewBox") || "";
          return e3 ? `id:${e3}` : n3 ? `viewBox:${n3}` : r3 ? `class:${r3}` : null;
        }
        findMainContent(t3) {
          const e3 = [];
          if (s.ENTRY_POINT_ELEMENTS.forEach((r4, n4) => {
            t3.querySelectorAll(r4).forEach((t4) => {
              let r5 = 40 * (s.ENTRY_POINT_ELEMENTS.length - n4);
              r5 += l.ContentScorer.scoreElement(t4), e3.push({ element: t4, score: r5, selectorIndex: n4 });
            });
          }), e3.length === 0)
            return this.findContentByScoring(t3);
          if (e3.sort((t4, e4) => e4.score - t4.score), this.debug && this._log("Content candidates:", e3.map((t4) => ({ element: t4.element.tagName, selector: this.getElementSelector(t4.element), score: t4.score }))), e3.length === 1 && e3[0].element.tagName.toLowerCase() === "body") {
            const e4 = this.findTableBasedContent(t3);
            if (e4)
              return e4;
          }
          const r3 = e3[0];
          let n3 = r3;
          for (let t4 = 1;t4 < e3.length; t4++) {
            const r4 = e3[t4], o2 = (r4.element.textContent || "").split(/\s+/).length;
            r4.selectorIndex < n3.selectorIndex && n3.element.contains(r4.element) && o2 > 50 && (n3 = r4);
          }
          return n3 !== r3 ? n3.element : r3.element;
        }
        findTableBasedContent(t3) {
          if (!Array.from(t3.getElementsByTagName("table")).some((t4) => {
            var e4;
            const r3 = parseInt(t4.getAttribute("width") || "0"), n3 = this.getComputedStyle(t4);
            return r3 > 400 || ((e4 = n3 == null ? undefined : n3.width) === null || e4 === undefined ? undefined : e4.includes("px")) && parseInt(n3.width) > 400 || t4.getAttribute("align") === "center" || (t4.className || "").toLowerCase().includes("content") || (t4.className || "").toLowerCase().includes("article");
          }))
            return null;
          const e3 = Array.from(t3.getElementsByTagName("td"));
          return l.ContentScorer.findBestElement(e3);
        }
        findContentByScoring(t3) {
          const e3 = [];
          return s.BLOCK_ELEMENTS.forEach((r3) => {
            Array.from(t3.getElementsByTagName(r3)).forEach((t4) => {
              const r4 = l.ContentScorer.scoreElement(t4);
              r4 > 0 && e3.push({ score: r4, element: t4 });
            });
          }), e3.length > 0 ? e3.sort((t4, e4) => e4.score - t4.score)[0].element : null;
        }
        getElementSelector(t3) {
          const e3 = [];
          let r3 = t3;
          for (;r3 && r3 !== this.doc.documentElement; ) {
            let t4 = r3.tagName.toLowerCase();
            r3.id ? t4 += "#" + r3.id : r3.className && typeof r3.className == "string" && (t4 += "." + r3.className.trim().split(/\s+/).join(".")), e3.unshift(t4), r3 = r3.parentElement;
          }
          return e3.join(" > ");
        }
        getComputedStyle(t3) {
          return (0, c.getComputedStyle)(t3);
        }
        resolveRelativeUrls(t3) {
          const e3 = this.options.url || this.doc.URL;
          if (!e3)
            return;
          const r3 = (t4) => {
            try {
              return new URL(t4, e3).href;
            } catch (e4) {
              return t4;
            }
          };
          t3.querySelectorAll("[href]").forEach((t4) => {
            const e4 = t4.getAttribute("href");
            e4 && t4.setAttribute("href", r3(e4));
          }), t3.querySelectorAll("[src]").forEach((t4) => {
            const e4 = t4.getAttribute("src");
            e4 && t4.setAttribute("src", r3(e4));
          }), t3.querySelectorAll("[srcset]").forEach((t4) => {
            const e4 = t4.getAttribute("srcset");
            if (e4) {
              const n3 = /(.+?)\s+(\d+(?:\.\d+)?[wx])/g, o2 = [];
              let i2, s2 = 0;
              for (;(i2 = n3.exec(e4)) !== null; ) {
                let t5 = i2[1].trim();
                s2 > 0 && (t5 = t5.replace(/^,\s*/, "")), s2 = n3.lastIndex, o2.push(`${r3(t5)} ${i2[2]}`);
              }
              if (o2.length > 0)
                t4.setAttribute("srcset", o2.join(", "));
              else {
                const n4 = e4.split(",").map((t5) => {
                  const e5 = t5.trim().split(/\s+/);
                  return e5[0] && (e5[0] = r3(e5[0])), e5.join(" ");
                }).join(", ");
                t4.setAttribute("srcset", n4);
              }
            }
          }), t3.querySelectorAll("[poster]").forEach((t4) => {
            const e4 = t4.getAttribute("poster");
            e4 && t4.setAttribute("poster", r3(e4));
          });
        }
        resolveContentUrls(t3) {
          if (!(this.options.url || this.doc.URL))
            return t3;
          const e3 = this.doc.createElement("div");
          return e3.innerHTML = t3, this.resolveRelativeUrls(e3), e3.innerHTML;
        }
        _extractSchemaOrgData(t3) {
          const e3 = t3.querySelectorAll('script[type="application/ld+json"]'), r3 = [];
          e3.forEach((t4) => {
            let e4 = t4.textContent || "";
            try {
              e4 = e4.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "").replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").replace(/^\s*(\*\/|\/\*)\s*|\s*(\*\/|\/\*)\s*$/g, "").trim();
              const t5 = JSON.parse(e4);
              t5["@graph"] && Array.isArray(t5["@graph"]) ? r3.push(...t5["@graph"]) : r3.push(t5);
            } catch (t5) {
              console.error("Defuddle: Error parsing schema.org data:", t5), this.debug && console.error("Defuddle: Problematic JSON content:", e4);
            }
          });
          const n3 = (t4) => {
            if (typeof t4 == "string")
              return this._decodeHTMLEntities(t4);
            if (Array.isArray(t4))
              return t4.map(n3);
            if (typeof t4 == "object" && t4 !== null) {
              const e4 = {};
              for (const r4 in t4)
                Object.prototype.hasOwnProperty.call(t4, r4) && (e4[r4] = n3(t4[r4]));
              return e4;
            }
            return t4;
          };
          return r3.map(n3);
        }
        _collectMetaTags() {
          const t3 = [];
          return this.doc.querySelectorAll("meta").forEach((e3) => {
            const r3 = e3.getAttribute("name"), n3 = e3.getAttribute("property");
            let o2 = e3.getAttribute("content");
            o2 && t3.push({ name: r3, property: n3, content: this._decodeHTMLEntities(o2) });
          }), t3;
        }
        _decodeHTMLEntities(t3) {
          const e3 = this.doc.createElement("textarea");
          return e3.innerHTML = t3, e3.value;
        }
      };
    }, 632: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.ChatGPTExtractor = undefined;
      const n2 = r2(181);

      class o extends n2.ConversationExtractor {
        constructor(t3, e3) {
          super(t3, e3), this.cachedMessages = null, this.articles = t3.querySelectorAll('article[data-testid^="conversation-turn-"]'), this.footnotes = [], this.footnoteCounter = 0;
        }
        canExtract() {
          return !!this.articles && this.articles.length > 0;
        }
        extractMessages() {
          if (this.cachedMessages)
            return this.cachedMessages;
          const t3 = [];
          return this.footnotes = [], this.footnoteCounter = 0, this.articles ? (this.articles.forEach((e3) => {
            var r3, n3;
            const o2 = e3.querySelector("h5.sr-only, h6.sr-only"), i = ((n3 = (r3 = o2 == null ? undefined : o2.textContent) === null || r3 === undefined ? undefined : r3.trim()) === null || n3 === undefined ? undefined : n3.replace(/:\s*$/, "")) || "";
            let s = "";
            const a = e3.getAttribute("data-message-author-role");
            a && (s = a);
            let l = e3.innerHTML || "";
            l = l.replace(/\u200B/g, "");
            const c = this.document.createElement("div");
            c.innerHTML = l, c.querySelectorAll('h5.sr-only, h6.sr-only, span[data-state="closed"]').forEach((t4) => t4.remove()), l = c.innerHTML;
            l = l.replace(/(&ZeroWidthSpace;)?(<span[^>]*?>\s*<a(?=[^>]*?href="([^"]+)")(?=[^>]*?target="_blank")(?=[^>]*?rel="noopener")[^>]*?>[\s\S]*?<\/a>\s*<\/span>)/gi, (t4, e4, r4, n4) => {
              let o3 = "", i2 = "";
              try {
                o3 = new URL(n4).hostname.replace(/^www\./, "");
                const t5 = n4.split("#:~:text=");
                if (t5.length > 1) {
                  i2 = decodeURIComponent(t5[1]), i2 = i2.replace(/%2C/g, ",");
                  const e5 = i2.split(",");
                  i2 = e5.length > 1 && e5[0].trim() ? ` — ${e5[0].trim()}...` : e5[0].trim() ? ` — ${i2.trim()}` : "";
                }
              } catch (t5) {
                console.error(`Failed to parse URL: ${n4}`, t5), o3 = n4;
              }
              let s2, a2 = this.footnotes.findIndex((t5) => t5.url === n4);
              return a2 === -1 ? (this.footnoteCounter++, s2 = this.footnoteCounter, this.footnotes.push({ url: n4, text: `<a href="${n4}">${o3}</a>${i2}` })) : s2 = a2 + 1, `<sup id="fnref:${s2}"><a href="#fn:${s2}">${s2}</a></sup>`;
            }), l = l.replace(/<p[^>]*>\s*<\/p>/g, ""), t3.push({ author: i, content: l.trim(), metadata: { role: s || "unknown" } });
          }), this.cachedMessages = t3, t3) : t3;
        }
        getFootnotes() {
          return this.footnotes;
        }
        getMetadata() {
          const t3 = this.getTitle(), e3 = this.extractMessages();
          return { title: t3, site: "ChatGPT", url: this.url, messageCount: e3.length, description: `ChatGPT conversation with ${e3.length} messages` };
        }
        getTitle() {
          var t3, e3, r3;
          const n3 = (t3 = this.document.title) === null || t3 === undefined ? undefined : t3.trim();
          if (n3 && n3 !== "ChatGPT")
            return n3;
          const o2 = (r3 = (e3 = this.articles) === null || e3 === undefined ? undefined : e3.item(0)) === null || r3 === undefined ? undefined : r3.querySelector(".text-message");
          if (o2) {
            const t4 = o2.textContent || "";
            return t4.length > 50 ? t4.slice(0, 50) + "..." : t4;
          }
          return "ChatGPT Conversation";
        }
      }
      e2.ChatGPTExtractor = o;
    }, 640: (t2, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.ALLOWED_ATTRIBUTES_DEBUG = e2.ALLOWED_ATTRIBUTES = e2.ALLOWED_EMPTY_ELEMENTS = e2.FOOTNOTE_LIST_SELECTORS = e2.FOOTNOTE_INLINE_REFERENCES = e2.PARTIAL_SELECTORS = e2.TEST_ATTRIBUTES = e2.EXACT_SELECTORS = e2.INLINE_ELEMENTS = e2.PRESERVE_ELEMENTS = e2.BLOCK_ELEMENTS = e2.MOBILE_WIDTH = e2.ENTRY_POINT_ELEMENTS = undefined, e2.ENTRY_POINT_ELEMENTS = ["#post", ".post-content", ".article-content", "#article-content", ".article_post", ".article-wrapper", ".entry-content", ".content-article", ".instapaper_body", ".post", ".markdown-body", "article", '[role="article"]', "main", '[role="main"]', "#content", "body"], e2.MOBILE_WIDTH = 600, e2.BLOCK_ELEMENTS = ["div", "section", "article", "main", "aside", "header", "footer", "nav", "content"], e2.PRESERVE_ELEMENTS = new Set(["pre", "code", "table", "thead", "tbody", "tr", "td", "th", "ul", "ol", "li", "dl", "dt", "dd", "figure", "figcaption", "picture", "details", "summary", "blockquote", "form", "fieldset"]), e2.INLINE_ELEMENTS = new Set(["a", "span", "strong", "em", "i", "b", "u", "code", "br", "small", "sub", "sup", "mark", "date", "del", "ins", "q", "abbr", "cite", "relative-time", "time", "font"]), e2.EXACT_SELECTORS = ["noscript", 'script:not([type^="math/"])', "style", "meta", "link", '.ad:not([class*="gradient"])', '[class^="ad-" i]', '[class$="-ad" i]', '[id^="ad-" i]', '[id$="-ad" i]', '[role="banner" i]', '[alt*="advert" i]', ".promo", ".Promo", "#barrier-page", ".alert", '[id="comments" i]', '[id="comment" i]', 'div[class*="cover-"]', 'div[id*="cover-"]', "header", ".header:not(.banner)", "#header", "#Header", "#banner", "#Banner", "nav", ".navigation", "#navigation", '[role="navigation" i]', '[role="dialog" i]', '[role*="complementary" i]', '[class*="pagination" i]', ".menu", "#siteSub", ".previous", ".author", ".Author", '[class$="_bio"]', "#categories", ".contributor", ".date", "#date", "[data-date]", ".entry-meta", ".meta", ".tags", "#tags", ".toc", ".Toc", "#toc", ".headline", "#headline", "#title", "#Title", "#articleTag", '[href*="/tag/"]', '[href*="/tags/"]', '[href*="/topics"]', '[href*="author"]', '[href*="#toc"]', '[href="#top"]', '[href="#Top"]', '[href="#page-header"]', '[href="#content"]', '[href="#site-content"]', '[href="#main-content"]', '[href^="#main"]', '[src*="author"]', "footer", ".aside", 'aside:not([class*="callout"])', "button", "canvas", "date", "dialog", "fieldset", "form", 'input:not([type="checkbox"])', "label", "option", "select", '[role="listbox"]', '[role="option"]', "textarea", "[hidden]", '[aria-hidden="true"]:not([class*="math"])', '[style*="display: none"]:not([class*="math"])', '[style*="display:none"]:not([class*="math"])', '[style*="visibility: hidden"]', '[style*="visibility:hidden"]', ".hidden", ".invisible", "instaread-player", 'iframe:not([src*="youtube"]):not([src*="youtu.be"]):not([src*="vimeo"]):not([src*="twitter"]):not([src*="x.com"]):not([src*="datawrapper"])', '[class="logo" i]', "#logo", "#Logo", "#newsletter", "#Newsletter", ".subscribe", ".noprint", '[data-print-layout="hide" i]', '[data-block="donotprint" i]', '[class*="clickable-icon" i]', 'li span[class*="ltx_tag" i][class*="ltx_tag_item" i]', 'a[href^="#"][class*="anchor" i]', 'a[href^="#"][class*="ref" i]', '[data-container*="most-viewed" i]', ".sidebar", ".Sidebar", "#sidebar", "#Sidebar", "#side-bar", "#sitesub", '[data-link-name*="skip" i]', '[aria-label*="skip" i]', ".copyright", "#copyright", ".licensebox", "#page-info", "#rss", "#feed", ".gutter", "#primaryaudio", "#NYT_ABOVE_MAIN_CONTENT_REGION", '[data-testid="photoviewer-children-figure"] > span', "table.infobox", '[data-optimizely="related-articles-section" i]', '[data-orientation="vertical"]', ".gh-header-sticky", '[data-testid="issue-metadata-sticky"]'], e2.TEST_ATTRIBUTES = ["class", "id", "data-test", "data-testid", "data-test-id", "data-qa", "data-cy"], e2.PARTIAL_SELECTORS = ["a-statement", "access-wall", "activitypub", "actioncall", "addcomment", "advert", "adlayout", "ad-tldr", "ad-placement", "ads-container", "_ad_", "after_content", "after_main_article", "afterpost", "allterms", "-alert-", "alert-box", "appendix", "_archive", "around-the-web", "aroundpages", "article-author", "article-badges", "article-banner", "article-bottom-section", "article-bottom", "article-category", "article-card", "article-citation", "article__copy", "article_date", "article-date", "article-end ", "article_header", "article-header", "article__header", "article__hero", "article__info", "article-info", "article-meta", "article_meta", "article__meta", "articlename", "article-subject", "article_subject", "article-snippet", "article-separator", "article--share", "article--topics", "articletags", "article-tags", "article_tags", "articletitle", "article-title", "article_title", "articletopics", "article-topics", "article--lede", "articlewell", "associated-people", "audio-card", "author-bio", "author-box", "author-info", "author_info", "authorm", "author-mini-bio", "author-name", "author-publish-info", "authored-by", "avatar", "back-to-top", "backlink_container", "backlinks-section", "bio-block", "biobox", "blog-pager", "bookmark-", "-bookmark", "bottominfo", "bottomnav", "bottom-of-article", "bottom-wrapper", "brand-bar", "bcrumb", "breadcrumb", "brdcrumb", "button-wrapper", "buttons-container", "btn-", "-btn", "byline", "captcha", "card-text", "card-media", "card-post", "carouselcontainer", "carousel-container", "cat_header", "catlinks", "_categories", "card-author", "card-content", "chapter-list", "collections", "comments", "commentbox", "comment-button", "commentcomp", "comment-content", "comment-count", "comment-form", "comment-number", "comment-respond", "comment-thread", "comment-wrap", "complementary", "consent", "contact-", "content-card", "content-topics", "contentpromo", "context-bar", "context-widget", "core-collateral", "cover-image", "cover-photo", "cover-wrap", "created-date", "creative-commons_", "c-subscribe", "_cta", "-cta", "cta-", "cta_", "current-issue", "custom-list-number", "dateline", "dateheader", "date-header", "date-pub", "disclaimer", "disclosure", "discussion", "discuss_", "disqus", "donate", "donation", "dropdown", "eletters", "emailsignup", "engagement-widget", "enhancement", "entry-author-info", "entry-categories", "entry-date", "entry-title", "entry-utility", "-error", "error-", "eyebrow", "expand-reduce", "external-anchor", "externallinkembedwrapper", "extra-services", "extra-title", "facebook", "fancy-box", "favorite", "featured-content", "feature_feed", "feedback", "feed-links", "field-site-sections", "fixheader", "floating-vid", "follower", "footer", "footnote-back", "footnoteback", "form-group", "for-you", "frontmatter", "further-reading", "fullbleedheader", "gated-", "gh-feed", "gist-meta", "goog-", "graph-view", "hamburger", "header_logo", "header-logo", "header-pattern", "hero-list", "hide-for-print", "hide-print", "hide-when-no-script", "hidden-print", "hidden-sidenote", "hidden-accessibility", "infoline", "instacartIntegration", "interlude", "interaction", "itemendrow", "invisible", "jumplink", "jump-to-", "js-skip-to-content", "keepreading", "keep-reading", "keep_reading", "keyword_wrap", "kicker", "labstab", "-labels", "language-name", "lastupdated", "latest-content", "-ledes-", "-license", "license-", "lightbox-popup", "like-button", "link-box", "links-grid", "links-title", "listing-dynamic-terms", "list-tags", "listinks", "loading", "loa-info", "logo_container", "ltx_role_refnum", "ltx_tag_bibitem", "ltx_error", "masthead", "marketing", "media-inquiry", "-menu", "menu-", "metadata", "might-like", "minibio", "more-about", "_modal", "-modal", "more-", "morenews", "morestories", "more_wrapper", "most-read", "move-helper", "mw-editsection", "mw-cite-backlink", "mw-indicators", "mw-jump-link", "nav-", "nav_", "navigation-post", "next-", "newsgallery", "news-story-title", "newsletter_", "newsletterbanner", "newslettercontainer", "newsletter-form", "newsletter-signup", "newslettersignup", "newsletterwidget", "newsletterwrapper", "not-found", "notessection", "nomobile", "noprint", "open-slideshow", "originally-published", "other-blogs", "outline-view", "pagehead", "page-header", "page-title", "paywall_message", "-partners", "permission-", "plea", "popular", "popup_links", "pop_stories", "pop-up", "post-author", "post-bottom", "post__category", "postcomment", "postdate", "post-date", "post_date", "post-details", "post-feeds", "postinfo", "post-info", "post_info", "post-inline-date", "post-links", "postlist", "post_list", "post_meta", "post-meta", "postmeta", "post_more", "postnavi", "post-navigation", "postpath", "post-preview", "postsnippet", "post_snippet", "post-snippet", "post-subject", "posttax", "post-tax", "post_tax", "posttag", "post_tag", "post-tag", "post_time", "posttitle", "post-title", "post_title", "post__title", "post-ufi-button", "prev-post", "prevnext", "prev_next", "prev-next", "previousnext", "press-inquiries", "print-none", "print-header", "print:hidden", "privacy-notice", "privacy-settings", "profile", "promo_article", "promo-bar", "promo-box", "pubdate", "pub_date", "pub-date", "publish_date", "publish-date", "publication-date", "publicationName", "qr-code", "qr_code", "quick_up", "_rail", "ratingssection", "read_also", "readmore", "read-next", "read_next", "read_time", "read-time", "reading_time", "reading-time", "reading-list", "recent-", "recent-articles", "recentpost", "recent_post", "recent-post", "recommend", "redirectedfrom", "recirc", "register", "related", "relevant", "reversefootnote", "_rss", "rss-link", "screen-reader-text", "scroll_to", "scroll-to", "_search", "-search", "section-nav", "series-banner", "share-box", "sharedaddy", "share-icons", "sharelinks", "share-post", "share-print", "share-section", "show-for-print", "sidebartitle", "sidebar-content", "sidebar-wrapper", "sideitems", "sidebar-author", "sidebar-item", "side-box", "side-logo", "sign-in-gate", "similar-", "similar_", "similars-", "site-index", "site-header", "siteheader", "site-logo", "site-name", "site-wordpress", "skip-content", "skip-to-content", "skip-link", "c-skip-link", "_skip-link", "-slider", "slug-wrap", "social-author", "social-shar", "social-date", "speechify-ignore", "speedbump", "sponsor", "springercitation", "sr-only", "_stats", "story-date", "story-navigation", "storyreadtime", "storysmall", "storypublishdate", "subject-label", "subhead", "submenu", "-subscribe-", "subscriber-drive", "subscription-", "_tags", "tags__item", "tag_list", "taxonomy", "table-of-contents", "tabs-", "terminaltout", "time-rubric", "timestamp", "time-read", "time-to-read", "tip_off", "tiptout", "-tout-", "toc-container", "toggle-caption", "tooltip", "topbar", "topic-list", "topic-subnav", "top-wrapper", "tree-item", "trending", "trust-feat", "trust-badge", "trust-project", "twitter", "u-hide", "upsell", "viewbottom", "visually-hidden", "welcomebox", "widget_pages"], e2.FOOTNOTE_INLINE_REFERENCES = ["sup.reference", "cite.ltx_cite", 'sup[id^="fnr"]', 'span[id^="fnr"]', 'span[class*="footnote_ref"]', 'span[class*="footnote-ref"]', "span.footnote-link", "a.citation", 'a[id^="ref-link"]', 'a[href^="#fn"]', 'a[href^="#cite"]', 'a[href^="#reference"]', 'a[href^="#footnote"]', 'a[href^="#r"]', 'a[href^="#b"]', 'a[href*="cite_note"]', 'a[href*="cite_ref"]', "a.footnote-anchor", "span.footnote-hovercard-target a", 'a[role="doc-biblioref"]', 'a[id^="fnref"]', 'a[id^="ref-link"]', "sup.footnoteref"].join(","), e2.FOOTNOTE_LIST_SELECTORS = ["div.footnote ol", "div.footnotes ol", 'div[role="doc-endnotes"]', 'div[role="doc-footnotes"]', "ol.footnotes-list", "ol.footnotes", "ol.references", 'ol[class*="article-references"]', "section.footnotes ol", 'section[role="doc-endnotes"]', 'section[role="doc-footnotes"]', 'section[role="doc-bibliography"]', "ul.footnotes-list", "ul.ltx_biblist", 'div.footnote[data-component-name="FootnoteToDOM"]', "div.footnotes-footer"].join(","), e2.ALLOWED_EMPTY_ELEMENTS = new Set(["area", "audio", "base", "br", "circle", "col", "defs", "ellipse", "embed", "figure", "g", "hr", "iframe", "img", "input", "line", "link", "mask", "meta", "object", "param", "path", "pattern", "picture", "polygon", "polyline", "rect", "source", "stop", "svg", "td", "th", "track", "use", "video", "wbr"]), e2.ALLOWED_ATTRIBUTES = new Set(["alt", "allow", "allowfullscreen", "aria-label", "checked", "colspan", "controls", "data-latex", "data-src", "data-srcset", "data-callout", "data-lang", "dir", "display", "frameborder", "headers", "height", "href", "kind", "label", "lang", "role", "rowspan", "src", "srclang", "srcset", "title", "type", "width", "accent", "accentunder", "align", "columnalign", "columnlines", "columnspacing", "columnspan", "data-mjx-texclass", "depth", "displaystyle", "fence", "frame", "framespacing", "linethickness", "lspace", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "scriptlevel", "separator", "stretchy", "symmetric", "voffset", "xmlns"]), e2.ALLOWED_ATTRIBUTES_DEBUG = new Set(["class", "id"]);
    }, 649: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.imageRules = undefined;
      const n2 = r2(552), o = /^data:image\/([^;]+);base64,/, i = /\.(jpg|jpeg|png|webp)\s+\d/, s = /^\s*\S+\.(jpg|jpeg|png|webp)\S*\s*$/, a = /\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i, l = /\s(\d+)w/, c = /dpr=(\d+(?:\.\d+)?)/, u = /^([^\s]+)/, d = /^[\w\-\.\/\\]+\.(jpg|jpeg|png|gif|webp|svg)$/i, m = /^\d{4}-\d{2}-\d{2}$/;
      function h(t3, e3, r3) {
        const o2 = r3.createElement("figure");
        o2.appendChild(t3.cloneNode(true));
        const i2 = r3.createElement("figcaption"), s2 = function(t4) {
          const e4 = [], r4 = new Set, o3 = (t5) => {
            var i4;
            if ((0, n2.isTextNode)(t5)) {
              const n3 = ((i4 = t5.textContent) === null || i4 === undefined ? undefined : i4.trim()) || "";
              n3 && !r4.has(n3) && (e4.push(n3), r4.add(n3));
            } else if ((0, n2.isElement)(t5)) {
              const e5 = t5.childNodes;
              for (let t6 = 0;t6 < e5.length; t6++)
                o3(e5[t6]);
            }
          }, i3 = t4.childNodes;
          for (let t5 = 0;t5 < i3.length; t5++)
            o3(i3[t5]);
          if (e4.length > 0)
            return e4.join(" ");
          return t4.innerHTML;
        }(e3);
        return i2.innerHTML = s2, o2.appendChild(i2), o2;
      }
      function f(t3, e3) {
        e3.setAttribute("srcset", t3);
        const r3 = T(t3);
        r3 && y(r3) && e3.setAttribute("src", r3);
      }
      function p(t3, e3, r3) {
        for (let n3 = 0;n3 < t3.attributes.length; n3++) {
          const o2 = t3.attributes[n3];
          r3.includes(o2.name) || e3.setAttribute(o2.name, o2.value);
        }
      }
      function g(t3) {
        const e3 = t3.match(o);
        if (!e3)
          return false;
        if (e3[1] === "svg+xml")
          return false;
        const r3 = e3[0].length;
        return t3.length - r3 < 133;
      }
      function v(t3) {
        return t3.startsWith("data:image/svg+xml");
      }
      function y(t3) {
        return !t3.startsWith("data:") && (!(!t3 || t3.trim() === "") && (a.test(t3) || t3.includes("image") || t3.includes("img") || t3.includes("photo")));
      }
      function b(t3) {
        if (E(t3))
          return true;
        return t3.querySelectorAll("img, video, picture, source").length > 0;
      }
      function E(t3) {
        const e3 = t3.tagName.toLowerCase();
        return e3 === "img" || e3 === "video" || e3 === "picture" || e3 === "source";
      }
      function x(t3) {
        if (E(t3))
          return t3;
        const e3 = t3.querySelectorAll("picture");
        if (e3.length > 0)
          return e3[0];
        const r3 = t3.querySelectorAll("img"), n3 = [];
        for (let t4 = 0;t4 < r3.length; t4++) {
          const e4 = r3[t4], o3 = e4.getAttribute("src") || "", i3 = e4.getAttribute("alt") || "";
          o3.includes("data:image/svg+xml") || (g(o3) || !i3.trim() && r3.length > 1 || n3.push(e4));
        }
        if (n3.length > 0)
          return n3[0];
        const o2 = t3.querySelectorAll("video");
        if (o2.length > 0)
          return o2[0];
        const i2 = t3.querySelectorAll("source");
        if (i2.length > 0)
          return i2[0];
        const s2 = t3.querySelectorAll("img, picture, source, video");
        return s2.length > 0 ? s2[0] : null;
      }
      function C(t3) {
        var e3, r3, n3, o2;
        const i2 = t3.querySelector("figcaption");
        if (i2)
          return i2;
        const s2 = new Set, a2 = ['[class*="caption"]', '[class*="description"]', '[class*="alt"]', '[class*="title"]', '[class*="credit"]', '[class*="text"]', '[class*="post-thumbnail-text"]', '[class*="image-caption"]', '[class*="photo-caption"]', "[aria-label]", "[title]"].join(", "), l2 = t3.querySelectorAll(a2);
        for (let t4 = 0;t4 < l2.length; t4++) {
          const r4 = l2[t4];
          if (E(r4))
            continue;
          const n4 = (e3 = r4.textContent) === null || e3 === undefined ? undefined : e3.trim();
          if (n4 && n4.length > 0 && !s2.has(n4))
            return s2.add(n4), r4;
        }
        const c2 = t3.querySelector("img");
        if (c2 && c2.hasAttribute("alt")) {
          const e4 = c2.getAttribute("alt");
          if (e4 && e4.trim().length > 0) {
            const r4 = t3.ownerDocument.createElement("div");
            return r4.textContent = e4, r4;
          }
        }
        if (t3.parentElement) {
          const e4 = t3.parentElement.children;
          for (let n4 = 0;n4 < e4.length; n4++) {
            const o3 = e4[n4];
            if (o3 === t3)
              continue;
            if (Array.from(o3.classList).some((t4) => t4.includes("caption") || t4.includes("credit") || t4.includes("text") || t4.includes("description"))) {
              const t4 = (r3 = o3.textContent) === null || r3 === undefined ? undefined : r3.trim();
              if (t4 && t4.length > 0)
                return o3;
            }
          }
        }
        const u2 = t3.querySelectorAll("img");
        for (let t4 = 0;t4 < u2.length; t4++) {
          const e4 = u2[t4];
          if (!e4.parentElement)
            continue;
          let r4 = e4.nextElementSibling;
          for (;r4; ) {
            if (["EM", "STRONG", "SPAN", "I", "B", "SMALL", "CITE"].includes(r4.tagName)) {
              const t5 = (n3 = r4.textContent) === null || n3 === undefined ? undefined : n3.trim();
              if (t5 && t5.length > 0)
                return r4;
            }
            r4 = r4.nextElementSibling;
          }
        }
        for (let t4 = 0;t4 < u2.length; t4++) {
          const e4 = u2[t4], r4 = e4.parentElement;
          if (!r4)
            continue;
          const n4 = r4.querySelectorAll("em, strong, span, i, b, small, cite");
          for (let t5 = 0;t5 < n4.length; t5++) {
            const r5 = n4[t5];
            if (r5 === e4)
              continue;
            const i3 = (o2 = r5.textContent) === null || o2 === undefined ? undefined : o2.trim();
            if (i3 && i3.length > 0)
              return r5;
          }
        }
        return null;
      }
      function w(t3) {
        var e3;
        const r3 = ((e3 = t3.textContent) === null || e3 === undefined ? undefined : e3.trim()) || "";
        return !(r3.length < 10 || r3.startsWith("http://") || r3.startsWith("https://")) && (!d.test(r3) && (!r3.match(/^\d+$/) && !m.test(r3)));
      }
      function S(t3, e3) {
        const r3 = t3.tagName.toLowerCase();
        if (r3 === "img")
          return A(t3, e3);
        if (r3 === "picture") {
          const r4 = t3.querySelector("img");
          return r4 ? A(r4, e3) : t3.cloneNode(true);
        }
        return r3 === "source" ? function(t4, e4) {
          const r4 = e4.createElement("img"), n3 = t4.getAttribute("srcset");
          n3 && f(n3, r4);
          const o2 = t4.parentElement;
          if (o2) {
            const t5 = o2.querySelectorAll("img"), e5 = [];
            for (let r5 = 0;r5 < t5.length; r5++) {
              const n4 = t5[r5], o3 = n4.getAttribute("src") || "";
              g(o3) || v(o3) || o3 === "" || e5.push(n4);
            }
            if (e5.length > 0) {
              if (p(e5[0], r4, ["src", "srcset"]), !r4.hasAttribute("src") || !y(r4.getAttribute("src") || "")) {
                const t6 = e5[0].getAttribute("src");
                t6 && y(t6) && r4.setAttribute("src", t6);
              }
            } else {
              const t6 = o2.querySelector("img[data-src]");
              if (t6 && (p(t6, r4, ["src", "srcset"]), !r4.hasAttribute("src") || !y(r4.getAttribute("src") || ""))) {
                const e6 = t6.getAttribute("data-src");
                e6 && y(e6) && r4.setAttribute("src", e6);
              }
            }
          }
          return r4;
        }(t3, e3) : t3.cloneNode(true);
      }
      function A(t3, e3) {
        const r3 = t3.getAttribute("src") || "";
        if (g(r3) || v(r3)) {
          const r4 = t3.parentElement;
          if (r4) {
            const n3 = r4.querySelectorAll("source"), o2 = [];
            for (let t4 = 0;t4 < n3.length; t4++) {
              const e4 = n3[t4];
              e4.hasAttribute("data-srcset") && e4.getAttribute("data-srcset") !== "" && o2.push(e4);
            }
            if (o2.length > 0) {
              const r5 = e3.createElement("img"), n4 = t3.getAttribute("data-src");
              return n4 && !v(n4) && r5.setAttribute("src", n4), p(t3, r5, ["src"]), r5;
            }
          }
        }
        return t3.cloneNode(true);
      }
      function T(t3) {
        if (!t3 || !t3.trim())
          return null;
        const e3 = t3.trim(), r3 = /(.+?)\s+(\d+(?:\.\d+)?[wx])/g;
        let n3, o2 = 0;
        for (;(n3 = r3.exec(e3)) !== null; ) {
          let t4 = n3[1].trim();
          if (o2 > 0 && (t4 = t4.replace(/^,\s*/, "")), o2 = r3.lastIndex, t4 && !v(t4))
            return t4;
        }
        const i2 = e3.match(u);
        return i2 && i2[1] && !v(i2[1]) ? i2[1] : null;
      }
      function L(t3) {
        if (t3.length === 0)
          return null;
        if (t3.length === 1)
          return t3[0];
        for (let e4 = 0;e4 < t3.length; e4++)
          if (!t3[e4].hasAttribute("media"))
            return t3[e4];
        let e3 = null, r3 = 0;
        for (let n3 = 0;n3 < t3.length; n3++) {
          const o2 = t3[n3], i2 = o2.getAttribute("srcset");
          if (!i2)
            continue;
          const s2 = i2.match(l), a2 = i2.match(c);
          if (s2 && s2[1]) {
            const t4 = parseInt(s2[1], 10) * (a2 ? parseFloat(a2[1]) : 1);
            t4 > r3 && (r3 = t4, e3 = o2);
          }
        }
        return e3 || t3[0];
      }
      e2.imageRules = [{ selector: "picture", element: "picture", transform: (t3, e3) => {
        const r3 = t3.querySelectorAll("source"), n3 = t3.querySelector("img");
        if (!n3) {
          console.warn("Picture element without img fallback:", t3.outerHTML);
          const n4 = L(r3);
          if (n4) {
            const r4 = n4.getAttribute("srcset");
            if (r4) {
              const n5 = e3.createElement("img");
              return f(r4, n5), t3.innerHTML = "", t3.appendChild(n5), t3;
            }
          }
          return t3;
        }
        let o2 = null, i2 = null;
        if (r3.length > 0) {
          const t4 = L(r3);
          t4 && (o2 = t4.getAttribute("srcset"), o2 && (i2 = T(o2)));
        }
        if (o2 && n3.setAttribute("srcset", o2), i2 && y(i2))
          n3.setAttribute("src", i2);
        else if (!n3.hasAttribute("src") || !y(n3.getAttribute("src") || "")) {
          const t4 = T(n3.getAttribute("srcset") || o2 || "");
          t4 && y(t4) && n3.setAttribute("src", t4);
        }
        return r3.forEach((t4) => t4.remove()), t3;
      } }, { selector: "uni-image-full-width", element: "figure", transform: (t3, e3) => {
        var r3;
        const n3 = e3.createElement("figure"), o2 = e3.createElement("img"), i2 = t3.querySelector("img");
        if (!i2)
          return console.warn("uni-image-full-width without img:", t3.outerHTML), n3;
        let s2 = i2.getAttribute("src");
        const a2 = i2.getAttribute("data-loading");
        if (a2)
          try {
            const t4 = JSON.parse(a2);
            t4.desktop && y(t4.desktop) && (s2 = t4.desktop);
          } catch (t4) {
            console.warn("Failed to parse data-loading attribute:", a2, t4);
          }
        if (!s2 || !y(s2))
          return console.warn("Could not find valid src for uni-image-full-width:", t3.outerHTML), n3;
        o2.setAttribute("src", s2);
        let l2 = i2.getAttribute("alt");
        l2 || (l2 = t3.getAttribute("alt-text")), l2 && o2.setAttribute("alt", l2), n3.appendChild(o2);
        const c2 = t3.querySelector("figcaption");
        if (c2) {
          const t4 = (r3 = c2.textContent) === null || r3 === undefined ? undefined : r3.trim();
          if (t4 && t4.length > 5) {
            const r4 = e3.createElement("figcaption"), o3 = c2.querySelector(".rich-text p");
            o3 ? r4.innerHTML = o3.innerHTML : r4.textContent = t4, n3.appendChild(r4);
          }
        }
        return n3;
      } }, { selector: 'img[data-src], img[data-srcset], img[loading="lazy"], img.lazy, img.lazyload', element: "img", transform: (t3, e3) => {
        const r3 = t3.getAttribute("src") || "", n3 = function(t4) {
          if (t4.hasAttribute("data-src") || t4.hasAttribute("data-srcset"))
            return true;
          for (let e4 = 0;e4 < t4.attributes.length; e4++) {
            const r4 = t4.attributes[e4];
            if (r4.name !== "src") {
              if (r4.name.startsWith("data-") && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(r4.value))
                return true;
              if (/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(r4.value))
                return true;
            }
          }
          return false;
        }(t3);
        g(r3) && n3 && t3.removeAttribute("src");
        const o2 = t3.getAttribute("data-src");
        o2 && !t3.getAttribute("src") && t3.setAttribute("src", o2);
        const a2 = t3.getAttribute("data-srcset");
        a2 && !t3.getAttribute("srcset") && t3.setAttribute("srcset", a2);
        for (let e4 = 0;e4 < t3.attributes.length; e4++) {
          const r4 = t3.attributes[e4];
          if (r4.name === "src" || r4.name === "srcset" || r4.name === "alt")
            continue;
          const n4 = r4.value.charAt(0);
          n4 !== "{" && n4 !== "[" && (i.test(r4.value) ? t3.setAttribute("srcset", r4.value) : s.test(r4.value) && t3.setAttribute("src", r4.value));
        }
        return t3.classList.remove("lazy", "lazyload"), t3.removeAttribute("data-ll-status"), t3.removeAttribute("data-src"), t3.removeAttribute("data-srcset"), t3.removeAttribute("loading"), t3;
      } }, { selector: "span:has(img)", element: "span", transform: (t3, e3) => {
        try {
          if (!b(t3))
            return t3;
          const r3 = x(t3);
          if (!r3)
            return t3;
          const n3 = C(t3), o2 = S(r3, e3);
          if (n3 && w(n3)) {
            const t4 = h(o2, n3, e3);
            return n3.parentNode && n3.parentNode.removeChild(n3), t4;
          }
          return o2;
        } catch (e4) {
          return console.warn("Error processing span with image:", e4), t3;
        }
      } }, { selector: 'figure, p:has([class*="caption"])', element: "figure", transform: (t3, e3) => {
        try {
          if (!b(t3))
            return t3;
          const r3 = x(t3);
          if (!r3)
            return t3;
          const n3 = C(t3);
          if (n3 && w(n3)) {
            const o2 = x(t3);
            let i2;
            return o2 ? i2 = o2 : (console.warn("Figure rule couldn't find current image element in:", t3.outerHTML), i2 = S(r3, e3)), h(i2, n3, e3);
          }
          return t3;
        } catch (e4) {
          return console.warn("Error processing complex image element:", e4), t3;
        }
      } }];
    }, 666: function(t2, e2, r2) {
      var n2 = this && this.__awaiter || function(t3, e3, r3, n3) {
        return new (r3 || (r3 = Promise))(function(o2, i2) {
          function s(t4) {
            try {
              l(n3.next(t4));
            } catch (t5) {
              i2(t5);
            }
          }
          function a(t4) {
            try {
              l(n3.throw(t4));
            } catch (t5) {
              i2(t5);
            }
          }
          function l(t4) {
            var e4;
            t4.done ? o2(t4.value) : (e4 = t4.value, e4 instanceof r3 ? e4 : new r3(function(t5) {
              t5(e4);
            })).then(s, a);
          }
          l((n3 = n3.apply(t3, e3 || [])).next());
        });
      };
      Object.defineProperty(e2, "__esModule", { value: true }), e2.XOembedExtractor = undefined;
      const o = r2(279);

      class i extends o.BaseExtractor {
        canExtract() {
          return false;
        }
        extract() {
          return { content: "", contentHtml: "" };
        }
        canExtractAsync() {
          return /\/(status|article)\/\d+/.test(this.url);
        }
        extractAsync() {
          return n2(this, undefined, undefined, function* () {
            const t3 = yield this.tryExtractFxTwitter();
            return t3 || this.extractOembed();
          });
        }
        extractOembed() {
          return n2(this, undefined, undefined, function* () {
            var t3;
            const e3 = `https://publish.twitter.com/oembed?url=${encodeURIComponent(this.url)}&omit_script=true`, r3 = yield fetch(e3);
            if (!r3.ok)
              throw new Error(`oEmbed request failed: ${r3.status}`);
            const n3 = yield r3.json(), o2 = this.document.createElement("div");
            o2.innerHTML = n3.html;
            const i2 = o2.querySelector("blockquote"), s = (i2 == null ? undefined : i2.querySelectorAll("p")) || [], a = Array.from(s).map((t4) => `<p>${t4.innerHTML}</p>`).join(`
`), l = n3.author_url ? `@${n3.author_url.split("/").pop()}` : "", c = i2 == null ? undefined : i2.querySelector("a:last-child"), u = ((t3 = c == null ? undefined : c.textContent) === null || t3 === undefined ? undefined : t3.trim()) || "", d = (c == null ? undefined : c.getAttribute("href")) || this.url, m = this.escapeHtml(n3.author_name), h = this.escapeHtml(l), f = this.escapeHtml(u), p = this.escapeHtml(d), g = `
			<div class="tweet-thread">
				<div class="main-tweet">
					<div class="tweet">
						<div class="tweet-header">
							<span class="tweet-author"><strong>${m}</strong> <span class="tweet-handle">${h}</span></span>
							${u ? `<a href="${p}" class="tweet-date">${f}</a>` : ""}
						</div>
						${a ? `<div class="tweet-text">${a}</div>` : ""}
					</div>
				</div>
			</div>
		`.trim();
            return { content: g, contentHtml: g, variables: { title: `Post by ${l || n3.author_name}`, author: l || n3.author_name, site: "X (Twitter)" } };
          });
        }
        tryExtractFxTwitter() {
          return n2(this, undefined, undefined, function* () {
            var t3, e3;
            const r3 = this.url.match(/\/([a-zA-Z][a-zA-Z0-9_]{0,14})\/(status|article)\/(\d+)/);
            if (!r3)
              return null;
            try {
              const n3 = yield this.fetchFxTwitter(r3[1], r3[3]);
              return ((t3 = n3.tweet) === null || t3 === undefined ? undefined : t3.article) ? this.buildArticleResult(n3) : ((e3 = n3.tweet) === null || e3 === undefined ? undefined : e3.text) ? this.buildTweetResult(n3) : null;
            } catch (t4) {
              return null;
            }
          });
        }
        fetchFxTwitter(t3, e3) {
          return n2(this, undefined, undefined, function* () {
            const r3 = `https://api.fxtwitter.com/${t3}/status/${e3}`, n3 = yield fetch(r3, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Defuddle/1.0; +https://defuddle.md)" } });
            if (!n3.ok)
              throw new Error(`FxTwitter API request failed: ${n3.status}`);
            return n3.json();
          });
        }
        buildArticleResult(t3) {
          const e3 = t3.tweet.article, { blocks: r3, entityMap: n3 } = e3.content, o2 = this.renderArticle(r3, n3, e3.cover_media), i2 = `@${t3.tweet.author.screen_name}`;
          return { content: o2, contentHtml: o2, variables: { title: e3.title, author: i2, site: "X (Twitter)", description: e3.preview_text } };
        }
        buildTweetResult(t3) {
          const e3 = t3.tweet, r3 = `@${e3.author.screen_name}`, n3 = this.renderTweet(e3);
          return { content: n3, contentHtml: n3, variables: { title: `Post by ${r3}`, author: r3, site: "X (Twitter)" } };
        }
        renderTweet(t3) {
          var e3, r3, n3;
          const o2 = ((e3 = t3.raw_text) === null || e3 === undefined ? undefined : e3.text) || t3.text, i2 = (((r3 = t3.raw_text) === null || r3 === undefined ? undefined : r3.facets) || []).filter((t4) => t4.type !== "media"), s = o2.split(/\n\n+/);
          let a = 0;
          const l = [];
          for (const t4 of s) {
            const e4 = o2.indexOf(t4, a), r4 = e4 + t4.length;
            a = r4;
            const n4 = t4.trimStart().startsWith(">");
            let s2 = n4 ? t4.trimStart().slice(1).trimStart() : t4;
            const c2 = n4 ? e4 + (t4.length - t4.trimStart().length) + 1 + (t4.trimStart().slice(1).length - t4.trimStart().slice(1).trimStart().length) : e4, u = this.applyFacets(s2, c2, r4, i2).replace(/\n/g, "<br>");
            n4 ? l.push(`<blockquote><p>${u}</p></blockquote>`) : u.trim() && l.push(`<p>${u}</p>`);
          }
          if ((n3 = t3.media) === null || n3 === undefined ? undefined : n3.photos)
            for (const e4 of t3.media.photos)
              l.push(`<img src="${this.escapeHtml(e4.url)}" alt="">`);
          const c = this.escapeHtml(`@${t3.author.screen_name}`);
          return `<div class="tweet-thread"><div class="main-tweet"><div class="tweet"><div class="tweet-header"><span class="tweet-author"><strong>${this.escapeHtml(t3.author.name)}</strong> <span class="tweet-handle">${c}</span></span></div><div class="tweet-text">${l.join(`
`)}</div></div></div></div>`;
        }
        applyMarkers(t3, e3) {
          if (e3.length === 0)
            return this.escapeHtml(t3);
          e3.sort((t4, e4) => t4.offset !== e4.offset ? t4.offset - e4.offset : t4.type === "close" && e4.type === "open" ? -1 : t4.type === "open" && e4.type === "close" ? 1 : 0);
          let r3 = "", n3 = 0;
          for (const o2 of e3)
            o2.offset > n3 && (r3 += this.escapeHtml(t3.slice(n3, o2.offset))), r3 += o2.tag, n3 = o2.offset;
          return n3 < t3.length && (r3 += this.escapeHtml(t3.slice(n3))), r3;
        }
        applyFacets(t3, e3, r3, n3) {
          const o2 = [];
          for (const i2 of n3) {
            const [n4, s] = i2.indices;
            if (s <= e3 || n4 >= r3)
              continue;
            const a = Math.max(0, n4 - e3), l = Math.min(t3.length, s - e3);
            if (i2.type === "italic")
              o2.push({ offset: a, type: "open", tag: "<em>" }), o2.push({ offset: l, type: "close", tag: "</em>" });
            else if (i2.type === "mention" && i2.text) {
              const t4 = `https://x.com/${this.escapeHtml(i2.text)}`;
              o2.push({ offset: a, type: "open", tag: `<a href="${t4}">` }), o2.push({ offset: l, type: "close", tag: "</a>" });
            } else if (i2.type === "url" && i2.original) {
              const t4 = this.escapeHtml(i2.original);
              o2.push({ offset: a, type: "open", tag: `<a href="${t4}">` }), o2.push({ offset: l, type: "close", tag: "</a>" });
            }
          }
          return this.applyMarkers(t3, o2);
        }
        renderArticle(t3, e3, r3) {
          var n3;
          const o2 = [];
          ((n3 = r3 == null ? undefined : r3.media_info) === null || n3 === undefined ? undefined : n3.original_img_url) && o2.push(`<img src="${this.escapeHtml(r3.media_info.original_img_url)}" alt="Cover image">`);
          let i2 = 0;
          for (;i2 < t3.length; ) {
            const r4 = t3[i2];
            if (r4.type === "unordered-list-item") {
              const r5 = [];
              for (;i2 < t3.length && t3[i2].type === "unordered-list-item"; )
                r5.push(`<li>${this.renderInlineContent(t3[i2], e3)}</li>`), i2++;
              o2.push(`<ul>${r5.join("")}</ul>`);
              continue;
            }
            const n4 = this.renderBlock(r4, e3);
            n4 && o2.push(n4), i2++;
          }
          return `<article class="x-article">${o2.join("")}</article>`;
        }
        renderBlock(t3, e3) {
          switch (t3.type) {
            case "unstyled":
            default:
              return t3.text.trim() ? `<p>${this.renderInlineContent(t3, e3)}</p>` : "";
            case "header-two":
              return `<h2>${this.renderInlineContent(t3, e3)}</h2>`;
            case "header-three":
              return `<h3>${this.renderInlineContent(t3, e3)}</h3>`;
            case "atomic":
              return this.renderAtomicBlock(t3, e3);
          }
        }
        renderAtomicBlock(t3, e3) {
          if (t3.entityRanges.length === 0)
            return "";
          const r3 = e3.find((e4) => e4.key === String(t3.entityRanges[0].key));
          if (!r3)
            return "";
          const n3 = r3.value;
          switch (n3.type) {
            case "MEDIA": {
              const t4 = n3.data.caption;
              return t4 ? `<figure><figcaption>${this.escapeHtml(t4)}</figcaption></figure>` : "";
            }
            case "MARKDOWN": {
              const t4 = n3.data.markdown || "", e4 = t4.match(/^```(\w*)\n([\s\S]*?)\n?```$/);
              if (e4) {
                const t5 = e4[1], r4 = e4[2];
                return `<pre><code${t5 ? ` class="language-${this.escapeHtml(t5)}" data-lang="${this.escapeHtml(t5)}"` : ""}>${this.escapeHtml(r4)}</code></pre>`;
              }
              return `<pre><code>${this.escapeHtml(t4)}</code></pre>`;
            }
            default:
              return "";
          }
        }
        renderInlineContent(t3, e3) {
          var r3, n3;
          const o2 = t3.text;
          if (!o2)
            return "";
          const i2 = [];
          for (const e4 of t3.inlineStyleRanges)
            e4.style === "Bold" && (i2.push({ offset: e4.offset, type: "open", tag: "<strong>" }), i2.push({ offset: e4.offset + e4.length, type: "close", tag: "</strong>" }));
          for (const r4 of t3.entityRanges) {
            const t4 = e3.find((t5) => t5.key === String(r4.key));
            if ((t4 == null ? undefined : t4.value.type) === "LINK" && t4.value.data.url) {
              const e4 = this.escapeHtml(t4.value.data.url);
              i2.push({ offset: r4.offset, type: "open", tag: `<a href="${e4}">` }), i2.push({ offset: r4.offset + r4.length, type: "close", tag: "</a>" });
            }
          }
          if ((r3 = t3.data) === null || r3 === undefined ? undefined : r3.mentions)
            for (const e4 of t3.data.mentions) {
              const t4 = `https://x.com/${this.escapeHtml(e4.text)}`;
              i2.push({ offset: e4.fromIndex, type: "open", tag: `<a href="${t4}">` }), i2.push({ offset: e4.toIndex, type: "close", tag: "</a>" });
            }
          if ((n3 = t3.data) === null || n3 === undefined ? undefined : n3.urls)
            for (const e4 of t3.data.urls) {
              const t4 = this.escapeHtml(e4.text);
              i2.push({ offset: e4.fromIndex, type: "open", tag: `<a href="${t4}">` }), i2.push({ offset: e4.toIndex, type: "close", tag: "</a>" });
            }
          return this.applyMarkers(o2, i2);
        }
        escapeHtml(t3) {
          return t3.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        }
      }
      e2.XOembedExtractor = i;
    }, 732: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.GeminiExtractor = undefined;
      const n2 = r2(181);

      class o extends n2.ConversationExtractor {
        constructor(t3, e3) {
          super(t3, e3), this.messageCount = null, this.conversationContainers = t3.querySelectorAll("div.conversation-container"), this.footnotes = [];
        }
        canExtract() {
          return !!this.conversationContainers && this.conversationContainers.length > 0;
        }
        extractMessages() {
          this.messageCount = 0;
          const t3 = [];
          return this.conversationContainers ? (this.extractSources(), this.conversationContainers.forEach((e3) => {
            const r3 = e3.querySelector("user-query");
            if (r3) {
              const e4 = r3.querySelector(".query-text");
              if (e4) {
                const r4 = e4.innerHTML || "";
                t3.push({ author: "You", content: r4.trim(), metadata: { role: "user" } });
              }
            }
            const n3 = e3.querySelector("model-response");
            if (n3) {
              const e4 = n3.querySelector(".model-response-text .markdown"), r4 = n3.querySelector("#extended-response-markdown-content") || e4;
              if (r4) {
                let e5 = r4.innerHTML || "";
                const n4 = this.document.createElement("div");
                n4.innerHTML = e5, n4.querySelectorAll(".table-content").forEach((t4) => {
                  t4.classList.remove("table-content");
                }), e5 = n4.innerHTML, t3.push({ author: "Gemini", content: e5.trim(), metadata: { role: "assistant" } });
              }
            }
          }), this.messageCount = t3.length, t3) : t3;
        }
        extractSources() {
          const t3 = this.document.querySelectorAll("browse-item");
          t3 && t3.length > 0 && t3.forEach((t4) => {
            var e3, r3, n3, o2;
            const i = t4.querySelector("a");
            if (i instanceof HTMLAnchorElement) {
              const t5 = i.href, s = ((r3 = (e3 = i.querySelector(".domain")) === null || e3 === undefined ? undefined : e3.textContent) === null || r3 === undefined ? undefined : r3.trim()) || "", a = ((o2 = (n3 = i.querySelector(".title")) === null || n3 === undefined ? undefined : n3.textContent) === null || o2 === undefined ? undefined : o2.trim()) || "";
              t5 && (s || a) && this.footnotes.push({ url: t5, text: a ? `${s}: ${a}` : s });
            }
          });
        }
        getFootnotes() {
          return this.footnotes;
        }
        getMetadata() {
          var t3;
          const e3 = this.getTitle(), r3 = (t3 = this.messageCount) !== null && t3 !== undefined ? t3 : this.extractMessages().length;
          return { title: e3, site: "Gemini", url: this.url, messageCount: r3, description: `Gemini conversation with ${r3} messages` };
        }
        getTitle() {
          var t3, e3, r3, n3, o2;
          const i = (t3 = this.document.title) === null || t3 === undefined ? undefined : t3.trim();
          if (i && i !== "Gemini" && !i.includes("Gemini"))
            return i;
          const s = (r3 = (e3 = this.document.querySelector(".title-text")) === null || e3 === undefined ? undefined : e3.textContent) === null || r3 === undefined ? undefined : r3.trim();
          if (s)
            return s;
          const a = (o2 = (n3 = this.conversationContainers) === null || n3 === undefined ? undefined : n3.item(0)) === null || o2 === undefined ? undefined : o2.querySelector(".query-text");
          if (a) {
            const t4 = a.textContent || "";
            return t4.length > 50 ? t4.slice(0, 50) + "..." : t4;
          }
          return "Gemini Conversation";
        }
      }
      e2.GeminiExtractor = o;
    }, 754: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.codeBlockRules = undefined;
      const n2 = r2(552), o = [/^language-(\w+)$/, /^lang-(\w+)$/, /^(\w+)-code$/, /^code-(\w+)$/, /^syntax-(\w+)$/, /^code-snippet__(\w+)$/, /^highlight-(\w+)$/, /^(\w+)-snippet$/, /(?:^|\s)(?:language|lang|brush|syntax)-(\w+)(?:\s|$)/i], i = new Set(["abap", "actionscript", "ada", "adoc", "agda", "antlr4", "applescript", "arduino", "armasm", "asciidoc", "aspnet", "atom", "bash", "batch", "c", "clojure", "cmake", "cobol", "coffeescript", "cpp", "c++", "crystal", "csharp", "cs", "dart", "django", "dockerfile", "dotnet", "elixir", "elm", "erlang", "fortran", "fsharp", "gdscript", "gitignore", "glsl", "golang", "gradle", "graphql", "groovy", "haskell", "hs", "haxe", "hlsl", "html", "idris", "java", "javascript", "js", "jsx", "jsdoc", "json", "jsonp", "julia", "kotlin", "latex", "lisp", "elisp", "livescript", "lua", "makefile", "markdown", "md", "markup", "masm", "mathml", "matlab", "mongodb", "mysql", "nasm", "nginx", "nim", "nix", "objc", "ocaml", "pascal", "perl", "php", "postgresql", "powershell", "prolog", "puppet", "python", "regex", "rss", "ruby", "rb", "rust", "scala", "scheme", "shell", "sh", "solidity", "sparql", "sql", "ssml", "svg", "swift", "tcl", "terraform", "tex", "toml", "typescript", "ts", "tsx", "unrealscript", "verilog", "vhdl", "webassembly", "wasm", "xml", "yaml", "yml", "zig"]);
      e2.codeBlockRules = [{ selector: ["pre", 'div[class*="prismjs"]', ".syntaxhighlighter", ".highlight", ".highlight-source", ".wp-block-syntaxhighlighter-code", ".wp-block-code", 'div[class*="language-"]'].join(", "), element: "pre", transform: (t3, e3) => {
        if (!((t4) => ("classList" in t4) && ("getAttribute" in t4) && ("querySelector" in t4))(t3))
          return t3;
        const r3 = (t4) => {
          var e4;
          const r4 = t4.getAttribute("data-lang") || t4.getAttribute("data-language") || t4.getAttribute("language");
          if (r4)
            return r4.toLowerCase();
          const n3 = Array.from(t4.classList || []);
          if ((e4 = t4.classList) === null || e4 === undefined ? undefined : e4.contains("syntaxhighlighter")) {
            const t5 = n3.find((t6) => !["syntaxhighlighter", "nogutter"].includes(t6));
            if (t5 && i.has(t5.toLowerCase()))
              return t5.toLowerCase();
          }
          for (const t5 of n3)
            for (const e5 of o) {
              const r5 = t5.toLowerCase().match(e5);
              if (r5 && r5[1] && i.has(r5[1].toLowerCase()))
                return r5[1].toLowerCase();
            }
          for (const t5 of n3)
            if (i.has(t5.toLowerCase()))
              return t5.toLowerCase();
          return "";
        };
        let s = "", a = t3;
        for (;a && !s; ) {
          s = r3(a);
          const t4 = a.querySelector("code");
          !s && t4 && (s = r3(t4)), a = a.parentElement;
        }
        const l = (t4) => {
          var e4;
          if ((0, n2.isTextNode)(t4))
            return ((e4 = t4.parentElement) === null || e4 === undefined ? undefined : e4.querySelector("[data-line], .line")) && !(t4.textContent || "").trim() ? "" : t4.textContent || "";
          let r4 = "";
          if ((0, n2.isElement)(t4)) {
            if (t4.tagName === "BR")
              return `
`;
            if (t4.matches('div[class*="line"], span[class*="line"], .ec-line, [data-line-number], [data-line]')) {
              const e5 = t4.querySelector('.code, .content, [class*="code-"], [class*="content-"]');
              if (e5)
                return (e5.textContent || "") + `
`;
              const r5 = t4.querySelector('.line-number, .gutter, [class*="line-number"], [class*="gutter"]');
              if (r5) {
                return Array.from(t4.childNodes).filter((t5) => !r5.contains(t5)).map((t5) => l(t5)).join("") + `
`;
              }
              return t4.textContent + `
`;
            }
            t4.childNodes.forEach((t5) => {
              r4 += l(t5);
            });
          }
          return r4;
        };
        let c = "";
        t3.matches(".syntaxhighlighter, .wp-block-syntaxhighlighter-code") && (c = ((t4) => {
          const e4 = t4.querySelector(".syntaxhighlighter table .code .container");
          if (e4)
            return Array.from(e4.children).map((t5) => {
              const e5 = Array.from(t5.querySelectorAll("code")).map((t6) => {
                var e6;
                let r5 = t6.textContent || "";
                return ((e6 = t6.classList) === null || e6 === undefined ? undefined : e6.contains("spaces")) && (r5 = " ".repeat(r5.length)), r5;
              }).join("");
              return e5 || t5.textContent || "";
            }).join(`
`);
          const r4 = t4.querySelectorAll(".code .line");
          return r4.length > 0 ? Array.from(r4).map((t5) => {
            const e5 = Array.from(t5.querySelectorAll("code")).map((t6) => t6.textContent || "").join("");
            return e5 || t5.textContent || "";
          }).join(`
`) : "";
        })(t3)), c || (c = l(t3)), c = c.replace(/^\s+|\s+$/g, "").replace(/\t/g, "    ").replace(/\n{3,}/g, `

`).replace(/\u00a0/g, " ").replace(/^\n+/, "").replace(/\n+$/, "");
        let u = t3;
        for (let e4 = 0;e4 < 3 && u; e4++) {
          const e5 = u.parentElement;
          if (!e5 || e5.tagName === "BODY")
            break;
          const r4 = Array.from(e5.children);
          for (const e6 of r4) {
            if (e6.contains(t3))
              continue;
            const r5 = e6.tagName;
            if (r5 !== "DIV" && r5 !== "SPAN")
              continue;
            (e6.textContent || "").trim().split(/\s+/).length <= 5 && !e6.querySelector("pre, code, img, table, h1, h2, h3, h4, h5, h6, p, blockquote, ul, ol") && e6.remove();
          }
          u = e5;
        }
        const d = e3.createElement("pre"), m = e3.createElement("code");
        return s && (m.setAttribute("data-lang", s), m.setAttribute("class", `language-${s}`)), m.textContent = c, d.appendChild(m), d;
      } }];
    }, 840: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.standardizeContent = function(t3, e3, r3, o2 = false) {
        if (function(t4) {
          const e4 = (t5) => {
            if ((0, c.isElement)(t5)) {
              const e5 = t5.tagName.toLowerCase();
              if (e5 === "pre" || e5 === "code")
                return;
            }
            if ((0, c.isTextNode)(t5)) {
              const e5 = t5.textContent || "", r4 = e5.replace(/\xA0/g, " ");
              r4 !== e5 && (t5.textContent = r4);
            }
            t5.hasChildNodes() && Array.from(t5.childNodes).forEach(e4);
          };
          e4(t4);
        }(t3), function(t4) {
          let e4 = 0;
          Array.from(t4.getElementsByTagName("*")).forEach((t5) => {
            Array.from(t5.childNodes).forEach((t6) => {
              (0, c.isCommentNode)(t6) && (t6.remove(), e4++);
            });
          }), (0, c.logDebug)("Removed HTML comments:", e4);
        }(t3), function(t4, e4, r4) {
          const o3 = (t5) => t5.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLowerCase(), i2 = t4.getElementsByTagName("h1");
          Array.from(i2).forEach((t5) => {
            var e5;
            const o4 = r4.createElement("h2");
            o4.innerHTML = t5.innerHTML, Array.from(t5.attributes).forEach((t6) => {
              n2.ALLOWED_ATTRIBUTES.has(t6.name) && o4.setAttribute(t6.name, t6.value);
            }), (e5 = t5.parentNode) === null || e5 === undefined || e5.replaceChild(o4, t5);
          });
          const s2 = t4.getElementsByTagName("h2");
          if (s2.length > 0) {
            const t5 = s2[0], r5 = o3(t5.textContent || ""), n3 = o3(e4);
            n3 && n3 === r5 && t5.remove();
          }
        }(t3, e3.title, r3), (0, s.standardizeFootnotes)(t3), function(t4, e4) {
          let r4 = 0;
          u.forEach((n3) => {
            let o3;
            try {
              o3 = t4.querySelectorAll(n3.selector);
            } catch (t5) {
              return;
            }
            o3.forEach((t5) => {
              if (n3.transform) {
                const o4 = n3.transform(t5, e4);
                t5.replaceWith(o4), r4++;
              }
            });
          });
          t4.querySelectorAll("lite-youtube").forEach((t5) => {
            const n3 = t5.getAttribute("videoid");
            if (!n3)
              return;
            const o3 = e4.createElement("iframe");
            o3.width = "560", o3.height = "315", o3.src = `https://www.youtube.com/embed/${n3}`, o3.title = t5.getAttribute("videotitle") || "YouTube video player", o3.frameBorder = "0", o3.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share", o3.setAttribute("allowfullscreen", ""), t5.replaceWith(o3), r4++;
          }), (0, c.logDebug)("Converted embedded elements:", r4);
        }(t3, r3), o2)
          m(t3, o2), d(t3), h(t3), (0, c.logDebug)("Debug mode: Skipping div flattening to preserve structure");
        else {
          f(t3, r3), m(t3, o2);
          Array.from(t3.querySelectorAll('a[href^="javascript:"]')).forEach((t4) => {
            for (var e4;t4.firstChild; )
              (e4 = t4.parentNode) === null || e4 === undefined || e4.insertBefore(t4.firstChild, t4);
            t4.remove();
          });
          Array.from(t3.querySelectorAll('a[href^="#"]')).forEach((t4) => {
            var e4;
            if (t4.querySelector("h1, h2, h3, h4, h5, h6")) {
              for (;t4.firstChild; )
                (e4 = t4.parentNode) === null || e4 === undefined || e4.insertBefore(t4.firstChild, t4);
              t4.remove();
            }
          }), t3.querySelectorAll("object, embed, applet").forEach((t4) => t4.remove()), function(t4) {
            let e4 = 0, r4 = 0, o3 = true;
            for (;o3; ) {
              r4++, o3 = false;
              const i2 = Array.from(t4.getElementsByTagName("*")).filter((t5) => {
                if (n2.ALLOWED_EMPTY_ELEMENTS.has(t5.tagName.toLowerCase()))
                  return false;
                const e5 = t5.textContent || "", r5 = e5.trim().length === 0, o4 = e5.includes(" "), i3 = !t5.hasChildNodes() || Array.from(t5.childNodes).every((t6) => {
                  if ((0, c.isTextNode)(t6)) {
                    const e6 = t6.textContent || "";
                    return e6.trim().length === 0 && !e6.includes(" ");
                  }
                  return false;
                });
                if (t5.tagName.toLowerCase() === "div") {
                  const e6 = Array.from(t5.children);
                  if (e6.length > 0 && e6.every((t6) => {
                    var e7;
                    if (t6.tagName.toLowerCase() !== "span")
                      return false;
                    const r6 = ((e7 = t6.textContent) === null || e7 === undefined ? undefined : e7.trim()) || "";
                    return r6 === "," || r6 === "" || r6 === " ";
                  }))
                    return true;
                }
                return r5 && !o4 && i3;
              });
              i2.length > 0 && (i2.forEach((t5) => {
                t5.remove(), e4++;
              }), o3 = true);
            }
            (0, c.logDebug)("Removed empty elements:", e4, "iterations:", r4);
          }(t3), d(t3), function(t4) {
            for (;; ) {
              let e4 = t4.firstChild;
              for (;e4 && (0, c.isTextNode)(e4) && !(e4.textContent || "").trim(); )
                e4 = e4.nextSibling;
              if (!e4 || !(0, c.isElement)(e4) || e4.tagName.toLowerCase() !== "hr")
                break;
              e4.remove();
            }
            for (;; ) {
              let e4 = t4.lastChild;
              for (;e4 && (0, c.isTextNode)(e4) && !(e4.textContent || "").trim(); )
                e4 = e4.previousSibling;
              if (!e4 || !(0, c.isElement)(e4) || e4.tagName.toLowerCase() !== "hr")
                break;
              e4.remove();
            }
          }(t3), f(t3, r3), h(t3), function(t4, e4) {
            let r4 = 0;
            const n3 = Date.now(), o3 = (t5) => {
              var e5;
              if ((0, c.isElement)(t5)) {
                const e6 = t5.tagName.toLowerCase();
                if (e6 === "pre" || e6 === "code")
                  return;
              }
              if (Array.from(t5.childNodes).forEach(o3), (0, c.isTextNode)(t5)) {
                const n4 = t5.textContent || "";
                if (!n4 || n4.match(/^[\u200C\u200B\u200D\u200E\u200F\uFEFF]*$/))
                  (e5 = t5.parentNode) === null || e5 === undefined || e5.removeChild(t5), r4++;
                else {
                  const e6 = n4.replace(/\n{3,}/g, `

`).replace(/^[\n\r\t]+/, "").replace(/[\n\r\t]+$/, "").replace(/[ \t]*\n[ \t]*/g, `
`).replace(/[ \t]{3,}/g, " ").replace(/^[ ]+$/, " ").replace(/\s+([,.!?:;])/g, "$1").replace(/[\u200B\u200D\u200E\u200F\uFEFF]+/g, "").replace(/(?:\xA0){2,}/g, " ");
                  e6 !== n4 && (t5.textContent = e6, r4 += n4.length - e6.length);
                }
              }
            }, i2 = (t5) => {
              var n4;
              if (!(0, c.isElement)(t5))
                return;
              const o4 = t5.tagName.toLowerCase();
              if (o4 === "pre" || o4 === "code")
                return;
              Array.from(t5.childNodes).filter(c.isElement).forEach(i2), t5.normalize();
              const s3 = ((n4 = (0, c.getComputedStyle)(t5)) === null || n4 === undefined ? undefined : n4.display) === "block", a2 = s3 ? /^[\n\r\t \u200C\u200B\u200D\u200E\u200F\uFEFF\xA0]*$/ : /^[\n\r\t\u200C\u200B\u200D\u200E\u200F\uFEFF]*$/, l2 = s3 ? /^[\n\r\t \u200C\u200B\u200D\u200E\u200F\uFEFF\xA0]*$/ : /^[\n\r\t\u200C\u200B\u200D\u200E\u200F\uFEFF]*$/;
              for (;t5.firstChild && (0, c.isTextNode)(t5.firstChild) && (t5.firstChild.textContent || "").match(a2); )
                t5.removeChild(t5.firstChild), r4++;
              for (;t5.lastChild && (0, c.isTextNode)(t5.lastChild) && (t5.lastChild.textContent || "").match(l2); )
                t5.removeChild(t5.lastChild), r4++;
              if (!s3) {
                const r5 = Array.from(t5.childNodes);
                for (let n5 = 0;n5 < r5.length - 1; n5++) {
                  const o5 = r5[n5], i3 = r5[n5 + 1];
                  if ((0, c.isElement)(o5) || (0, c.isElement)(i3)) {
                    const r6 = i3.textContent || "", n6 = o5.textContent || "", s4 = r6.match(/^[,.!?:;)\]]/), a3 = n6.match(/[,.!?:;(\[]\s*$/), l3 = (0, c.isTextNode)(o5) && (o5.textContent || "").endsWith(" ") || (0, c.isTextNode)(i3) && (i3.textContent || "").startsWith(" ");
                    if (!s4 && !a3 && !l3) {
                      const r7 = e4.createTextNode(" ");
                      t5.insertBefore(r7, i3);
                    }
                  }
                }
              }
            };
            o3(t4), i2(t4);
            const s2 = Date.now();
            (0, c.logDebug)("Removed empty lines:", { charactersRemoved: r4, processingTime: `${(s2 - n3).toFixed(2)}ms` });
          }(t3, r3);
        }
      };
      const n2 = r2(640), o = r2(0), i = r2(754), s = r2(610), a = r2(864), l = r2(649), c = r2(552), u = [...o.mathRules, ...i.codeBlockRules, ...a.headingRules, ...l.imageRules, { selector: 'aside[class*="callout"]', element: "blockquote", transform: (t3, e3) => {
        const r3 = e3.createElement("blockquote"), n3 = Array.from(t3.classList).find((t4) => t4.startsWith("callout-")), o2 = n3 ? n3.replace("callout-", "") : "note";
        r3.setAttribute("data-callout", o2);
        const i2 = t3.querySelector(".callout-content");
        return r3.innerHTML = i2 ? i2.innerHTML : t3.innerHTML, r3;
      } }, { selector: 'div[data-testid^="paragraph"], div[role="paragraph"]', element: "p", transform: (t3, e3) => {
        const r3 = e3.createElement("p");
        return r3.innerHTML = t3.innerHTML, Array.from(t3.attributes).forEach((t4) => {
          n2.ALLOWED_ATTRIBUTES.has(t4.name) && r3.setAttribute(t4.name, t4.value);
        }), r3;
      } }, { selector: 'div[role="list"]', element: "ul", transform: (t3, e3) => {
        var r3;
        const n3 = t3.querySelector('div[role="listitem"] .label'), o2 = (((r3 = n3 == null ? undefined : n3.textContent) === null || r3 === undefined ? undefined : r3.trim()) || "").match(/^\d+\)/), i2 = e3.createElement(o2 ? "ol" : "ul");
        return t3.querySelectorAll('div[role="listitem"]').forEach((t4) => {
          const r4 = e3.createElement("li"), n4 = t4.querySelector(".content");
          if (n4) {
            n4.querySelectorAll('div[role="paragraph"]').forEach((t5) => {
              const r5 = e3.createElement("p");
              r5.innerHTML = t5.innerHTML, t5.replaceWith(r5);
            });
            n4.querySelectorAll('div[role="list"]').forEach((t5) => {
              var r5;
              const n5 = t5.querySelector('div[role="listitem"] .label'), o3 = (((r5 = n5 == null ? undefined : n5.textContent) === null || r5 === undefined ? undefined : r5.trim()) || "").match(/^\d+\)/), i3 = e3.createElement(o3 ? "ol" : "ul");
              t5.querySelectorAll('div[role="listitem"]').forEach((t6) => {
                const r6 = e3.createElement("li"), n6 = t6.querySelector(".content");
                if (n6) {
                  n6.querySelectorAll('div[role="paragraph"]').forEach((t7) => {
                    const r7 = e3.createElement("p");
                    r7.innerHTML = t7.innerHTML, t7.replaceWith(r7);
                  }), r6.innerHTML = n6.innerHTML;
                }
                i3.appendChild(r6);
              }), t5.replaceWith(i3);
            }), r4.innerHTML = n4.innerHTML;
          }
          i2.appendChild(r4);
        }), i2;
      } }, { selector: 'div[role="listitem"]', element: "li", transform: (t3, e3) => {
        const r3 = t3.querySelector(".content");
        if (!r3)
          return t3;
        return r3.querySelectorAll('div[role="paragraph"]').forEach((t4) => {
          const r4 = e3.createElement("p");
          r4.innerHTML = t4.innerHTML, t4.replaceWith(r4);
        }), r3;
      } }];
      function d(t3) {
        let e3 = 0;
        const r3 = (e4) => {
          let n4 = "", o2 = e4.nextSibling;
          for (;o2; )
            ((0, c.isTextNode)(o2) || (0, c.isElement)(o2)) && (n4 += o2.textContent || ""), o2 = o2.nextSibling;
          if (n4.trim())
            return true;
          const i2 = e4.parentElement;
          return !(!i2 || i2 === t3) && r3(i2);
        }, n3 = Array.from(t3.querySelectorAll("h1, h2, h3, h4, h5, h6")).reverse();
        for (const t4 of n3) {
          if (r3(t4))
            break;
          t4.remove(), e3++;
        }
        e3 > 0 && (0, c.logDebug)("Removed trailing headings:", e3);
      }
      function m(t3, e3) {
        let r3 = 0;
        const o2 = (t4) => {
          if (t4.tagName.toLowerCase() === "svg" || t4.namespaceURI === "http://www.w3.org/2000/svg")
            return;
          const o3 = Array.from(t4.attributes), i2 = t4.tagName.toLowerCase();
          o3.forEach((o4) => {
            const s2 = o4.name.toLowerCase(), a2 = o4.value;
            s2 === "id" && (a2.startsWith("fnref:") || a2.startsWith("fn:") || a2 === "footnotes") || s2 === "class" && (i2 === "code" && a2.startsWith("language-") || a2 === "footnote-backref") || (e3 ? n2.ALLOWED_ATTRIBUTES.has(s2) || n2.ALLOWED_ATTRIBUTES_DEBUG.has(s2) || s2.startsWith("data-") || (t4.removeAttribute(o4.name), r3++) : n2.ALLOWED_ATTRIBUTES.has(s2) || (t4.removeAttribute(o4.name), r3++));
          });
        };
        o2(t3), t3.querySelectorAll("*").forEach(o2), (0, c.logDebug)("Stripped attributes:", r3);
      }
      function h(t3) {
        let e3 = 0;
        const r3 = Date.now(), n3 = Array.from(t3.getElementsByTagName("br"));
        let o2 = [];
        const i2 = () => {
          if (o2.length > 2)
            for (let t4 = 2;t4 < o2.length; t4++)
              o2[t4].remove(), e3++;
          o2 = [];
        };
        n3.forEach((t4) => {
          var e4;
          let r4 = false;
          if (o2.length > 0) {
            const n4 = o2[o2.length - 1];
            let i3 = t4.previousSibling;
            for (;i3 && (0, c.isTextNode)(i3) && !((e4 = i3.textContent) === null || e4 === undefined ? undefined : e4.trim()); )
              i3 = i3.previousSibling;
            i3 === n4 && (r4 = true);
          }
          r4 ? o2.push(t4) : (i2(), o2 = [t4]);
        }), i2();
        const s2 = Date.now();
        (0, c.logDebug)("Standardized br elements:", { removed: e3, processingTime: `${(s2 - r3).toFixed(2)}ms` });
      }
      function f(t3, e3) {
        let r3 = 0;
        const o2 = Date.now();
        let i2 = true;
        function s2(t4) {
          var e4;
          for (const r4 of t4.childNodes) {
            if ((0, c.isTextNode)(r4) && ((e4 = r4.textContent) === null || e4 === undefined ? undefined : e4.trim()))
              return true;
            if ((0, c.isElement)(r4) && n2.INLINE_ELEMENTS.has(r4.nodeName.toLowerCase()))
              return true;
          }
          return false;
        }
        const a2 = (t4) => {
          const e4 = t4.tagName.toLowerCase();
          if (n2.PRESERVE_ELEMENTS.has(e4))
            return true;
          const r4 = t4.getAttribute("role");
          if (r4 && ["article", "main", "navigation", "banner", "contentinfo"].includes(r4))
            return true;
          const o3 = t4.className;
          if (typeof o3 == "string" && o3.toLowerCase().match(/(?:article|main|content|footnote|reference|bibliography)/))
            return true;
          return !!Array.from(t4.children).some((t5) => n2.PRESERVE_ELEMENTS.has(t5.tagName.toLowerCase()) || t5.getAttribute("role") === "article" || t5.className && typeof t5.className == "string" && t5.className.toLowerCase().match(/(?:article|main|content|footnote|reference|bibliography)/));
        }, l2 = (t4) => {
          var e4;
          if (s2(t4))
            return false;
          if (!((e4 = t4.textContent) === null || e4 === undefined ? undefined : e4.trim()))
            return true;
          const r4 = Array.from(t4.children);
          if (r4.length === 0)
            return true;
          if (r4.every((t5) => {
            const e5 = t5.tagName.toLowerCase();
            return n2.BLOCK_ELEMENTS.includes(e5) || e5 === "p" || e5 === "h1" || e5 === "h2" || e5 === "h3" || e5 === "h4" || e5 === "h5" || e5 === "h6" || e5 === "ul" || e5 === "ol" || e5 === "pre" || e5 === "blockquote" || e5 === "figure";
          }))
            return true;
          const o3 = t4.className.toLowerCase();
          if (/(?:wrapper|container|layout|row|col|grid|flex|outer|inner|content-area)/i.test(o3))
            return true;
          const i3 = Array.from(t4.childNodes).filter((t5) => {
            var e5;
            return (0, c.isTextNode)(t5) && ((e5 = t5.textContent) === null || e5 === undefined ? undefined : e5.trim());
          });
          if (i3.length === 0)
            return true;
          return !(!(r4.length > 0) || r4.some((t5) => {
            const e5 = t5.tagName.toLowerCase();
            return n2.INLINE_ELEMENTS.has(e5);
          }));
        }, u2 = (o3) => {
          var i3, u3;
          if (!o3.isConnected || a2(o3))
            return false;
          const d3 = o3.tagName.toLowerCase();
          if (!n2.ALLOWED_EMPTY_ELEMENTS.has(d3) && !o3.children.length && !((i3 = o3.textContent) === null || i3 === undefined ? undefined : i3.trim()))
            return o3.remove(), r3++, true;
          if (o3.parentElement === t3) {
            const t4 = Array.from(o3.children);
            if (t4.length > 0 && !t4.some((t5) => {
              const e4 = t5.tagName.toLowerCase();
              return n2.INLINE_ELEMENTS.has(e4);
            })) {
              const t5 = e3.createDocumentFragment();
              for (;o3.firstChild; )
                t5.appendChild(o3.firstChild);
              return o3.replaceWith(t5), r3++, true;
            }
          }
          if (l2(o3)) {
            if (!Array.from(o3.children).some((t5) => {
              const e4 = t5.tagName.toLowerCase();
              return n2.INLINE_ELEMENTS.has(e4);
            })) {
              const t5 = e3.createDocumentFragment();
              for (;o3.firstChild; )
                t5.appendChild(o3.firstChild);
              return o3.replaceWith(t5), r3++, true;
            }
            const t4 = e3.createDocumentFragment();
            for (;o3.firstChild; )
              t4.appendChild(o3.firstChild);
            return o3.replaceWith(t4), r3++, true;
          }
          const m3 = Array.from(o3.childNodes);
          if (m3.length > 0 && m3.every((t4) => (0, c.isTextNode)(t4) || (0, c.isElement)(t4) && n2.INLINE_ELEMENTS.has(t4.nodeName.toLowerCase())) && ((u3 = o3.textContent) === null || u3 === undefined ? undefined : u3.trim())) {
            const t4 = e3.createElement("p");
            for (;o3.firstChild; )
              t4.appendChild(o3.firstChild);
            return o3.replaceWith(t4), r3++, true;
          }
          if (o3.children.length === 1) {
            const t4 = o3.firstElementChild, e4 = t4.tagName.toLowerCase();
            if (n2.BLOCK_ELEMENTS.includes(e4) && !a2(t4))
              return o3.replaceWith(t4), r3++, true;
          }
          let h3 = 0, f3 = o3.parentElement;
          for (;f3; ) {
            const t4 = f3.tagName.toLowerCase();
            n2.BLOCK_ELEMENTS.includes(t4) && h3++, f3 = f3.parentElement;
          }
          if (h3 > 0 && !s2(o3)) {
            const t4 = e3.createDocumentFragment();
            for (;o3.firstChild; )
              t4.appendChild(o3.firstChild);
            return o3.replaceWith(t4), r3++, true;
          }
          return false;
        }, d2 = () => {
          const e4 = Array.from(t3.children).filter((t4) => n2.BLOCK_ELEMENTS.includes(t4.tagName.toLowerCase()));
          let r4 = false;
          return e4.forEach((t4) => {
            u2(t4) && (r4 = true);
          }), r4;
        }, m2 = () => {
          const e4 = Array.from(t3.querySelectorAll(n2.BLOCK_ELEMENTS.join(","))).sort((t4, e5) => {
            const r5 = (t5) => {
              let e6 = 0, r6 = t5.parentElement;
              for (;r6; ) {
                const t6 = r6.tagName.toLowerCase();
                n2.BLOCK_ELEMENTS.includes(t6) && e6++, r6 = r6.parentElement;
              }
              return e6;
            };
            return r5(e5) - r5(t4);
          });
          let r4 = false;
          return e4.forEach((t4) => {
            u2(t4) && (r4 = true);
          }), r4;
        }, h2 = () => {
          const o3 = Array.from(t3.querySelectorAll(n2.BLOCK_ELEMENTS.join(",")));
          let i3 = false;
          return o3.forEach((t4) => {
            const n3 = Array.from(t4.children);
            if (n3.length > 0 && n3.every((t5) => t5.tagName.toLowerCase() === "p") || !a2(t4) && l2(t4)) {
              const n4 = e3.createDocumentFragment();
              for (;t4.firstChild; )
                n4.appendChild(t4.firstChild);
              t4.replaceWith(n4), r3++, i3 = true;
            }
          }), i3;
        };
        do {
          i2 = false, d2() && (i2 = true), m2() && (i2 = true), h2() && (i2 = true);
        } while (i2);
        const f2 = Date.now();
        (0, c.logDebug)("Flattened wrapper elements:", { count: r3, processingTime: `${(f2 - o2).toFixed(2)}ms` });
      }
    }, 864: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.headingRules = undefined;
      const n2 = r2(640);
      e2.headingRules = [{ selector: "h1, h2, h3, h4, h5, h6", element: "keep", transform: (t3) => {
        var e3;
        const r3 = t3.ownerDocument;
        if (!r3)
          return console.warn("No document available"), t3;
        const o = r3.createElement(t3.tagName);
        Array.from(t3.attributes).forEach((t4) => {
          n2.ALLOWED_ATTRIBUTES.has(t4.name) && o.setAttribute(t4.name, t4.value);
        });
        const i = t3.cloneNode(true), s = new Map;
        Array.from(i.querySelectorAll("*")).forEach((t4) => {
          var e4, r4, n3, o2, a2, l;
          let c = false;
          if (t4.tagName.toLowerCase() === "a") {
            const r5 = t4.getAttribute("href");
            ((r5 == null ? undefined : r5.includes("#")) || (r5 == null ? undefined : r5.startsWith("#"))) && (s.set(t4, ((e4 = t4.textContent) === null || e4 === undefined ? undefined : e4.trim()) || ""), c = true);
          }
          if (t4.classList.contains("anchor") && (s.set(t4, ((r4 = t4.textContent) === null || r4 === undefined ? undefined : r4.trim()) || ""), c = true), t4.tagName.toLowerCase() === "button" && (c = true), (t4.tagName.toLowerCase() === "span" || t4.tagName.toLowerCase() === "div") && t4.querySelector('a[href^="#"]')) {
            const e5 = t4.querySelector('a[href^="#"]');
            e5 && s.set(t4, ((n3 = e5.textContent) === null || n3 === undefined ? undefined : n3.trim()) || ""), c = true;
          }
          if (c) {
            const e5 = t4.parentElement;
            e5 && e5 !== i && ((o2 = e5.textContent) === null || o2 === undefined ? undefined : o2.trim()) === ((a2 = t4.textContent) === null || a2 === undefined ? undefined : a2.trim()) && s.set(e5, ((l = t4.textContent) === null || l === undefined ? undefined : l.trim()) || "");
          }
        });
        Array.from(i.querySelectorAll("*")).filter((t4) => {
          if (t4.tagName.toLowerCase() === "a") {
            const e4 = t4.getAttribute("href");
            return (e4 == null ? undefined : e4.includes("#")) || (e4 == null ? undefined : e4.startsWith("#"));
          }
          return !!t4.classList.contains("anchor") || (t4.tagName.toLowerCase() === "button" || !(t4.tagName.toLowerCase() !== "span" && t4.tagName.toLowerCase() !== "div" || !t4.querySelector('a[href^="#"]')));
        }).forEach((t4) => t4.remove());
        let a = ((e3 = i.textContent) === null || e3 === undefined ? undefined : e3.trim()) || "";
        return !a && s.size > 0 && (a = Array.from(s.values())[0]), o.textContent = a, o;
      } }];
    }, 917: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.ExtractorRegistry = undefined;
      const n2 = r2(959), o = r2(248), i = r2(64), s = r2(258), a = r2(458), l = r2(632), c = r2(397), u = r2(20), d = r2(732), m = r2(588), h = r2(666);

      class f {
        static initialize() {
          this.register({ patterns: ["x.com", "twitter.com"], extractor: i.XArticleExtractor }), this.register({ patterns: ["twitter.com", /\/x\.com\/.*/], extractor: o.TwitterExtractor }), this.register({ patterns: ["x.com", "twitter.com"], extractor: h.XOembedExtractor }), this.register({ patterns: ["reddit.com", "old.reddit.com", "new.reddit.com", /^https:\/\/[^\/]+\.reddit\.com/], extractor: n2.RedditExtractor }), this.register({ patterns: ["youtube.com", "youtu.be", /youtube\.com\/watch\?v=.*/, /youtu\.be\/.*/], extractor: s.YoutubeExtractor }), this.register({ patterns: [/news\.ycombinator\.com\/item\?id=.*/], extractor: a.HackerNewsExtractor }), this.register({ patterns: [/^https?:\/\/chatgpt\.com\/(c|share)\/.*/], extractor: l.ChatGPTExtractor }), this.register({ patterns: ["claude.ai", /^https?:\/\/claude\.ai\/(chat|share)\/.*/], extractor: c.ClaudeExtractor }), this.register({ patterns: [/^https?:\/\/grok\.com\/(chat|share)(\/.*)?$/], extractor: u.GrokExtractor }), this.register({ patterns: [/^https?:\/\/gemini\.google\.com\/app\/.*/], extractor: d.GeminiExtractor }), this.register({ patterns: ["github.com", /^https?:\/\/github\.com\/.*/], extractor: m.GitHubExtractor });
        }
        static register(t3) {
          this.mappings.push(t3);
        }
        static findExtractor(t3, e3, r3) {
          return this.findByPredicate(t3, e3, r3, (t4) => t4.canExtract());
        }
        static findAsyncExtractor(t3, e3, r3) {
          return this.findByPredicate(t3, e3, r3, (t4) => t4.canExtractAsync());
        }
        static findByPredicate(t3, e3, r3, n3) {
          try {
            const o2 = new URL(e3).hostname;
            for (const { patterns: i2, extractor: s2 } of this.mappings) {
              if (i2.some((t4) => t4 instanceof RegExp ? t4.test(e3) : o2.includes(t4))) {
                const o3 = new s2(t3, e3, r3);
                if (n3(o3))
                  return o3;
              }
            }
            return null;
          } catch (t4) {
            return console.error("Error finding extractor:", t4), null;
          }
        }
      }
      e2.ExtractorRegistry = f, f.mappings = [], f.initialize();
    }, 959: function(t2, e2, r2) {
      var n2 = this && this.__awaiter || function(t3, e3, r3, n3) {
        return new (r3 || (r3 = Promise))(function(o2, i2) {
          function s(t4) {
            try {
              l(n3.next(t4));
            } catch (t5) {
              i2(t5);
            }
          }
          function a(t4) {
            try {
              l(n3.throw(t4));
            } catch (t5) {
              i2(t5);
            }
          }
          function l(t4) {
            var e4;
            t4.done ? o2(t4.value) : (e4 = t4.value, e4 instanceof r3 ? e4 : new r3(function(t5) {
              t5(e4);
            })).then(s, a);
          }
          l((n3 = n3.apply(t3, e3 || [])).next());
        });
      };
      Object.defineProperty(e2, "__esModule", { value: true }), e2.RedditExtractor = undefined;
      const o = r2(279);

      class i extends o.BaseExtractor {
        constructor(t3, e3) {
          super(t3, e3), this.shredditPost = t3.querySelector("shreddit-post"), this.isOldReddit = !!t3.querySelector(".thing.link");
        }
        canExtract() {
          return !!this.shredditPost || this.isOldReddit;
        }
        canExtractAsync() {
          return this.isCommentsPage() && !this.isOldReddit;
        }
        isCommentsPage() {
          return /\/r\/.+\/comments\//.test(this.url);
        }
        extractAsync() {
          return n2(this, undefined, undefined, function* () {
            var t3, e3;
            const r3 = new URL(this.url);
            r3.hostname = "old.reddit.com";
            const n3 = yield fetch(r3.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; Defuddle/1.0)" } });
            if (!n3.ok)
              throw new Error(`Failed to fetch old.reddit.com: ${n3.status}`);
            const o2 = yield n3.text(), i2 = (e3 = (t3 = this.document.defaultView) === null || t3 === undefined ? undefined : t3.DOMParser) !== null && e3 !== undefined ? e3 : typeof DOMParser != "undefined" ? DOMParser : null;
            if (!i2)
              throw new Error("DOMParser is not available in this environment");
            const s = new i2().parseFromString(o2, "text/html");
            return this.extractOldReddit(s);
          });
        }
        extract() {
          var t3, e3;
          if (this.isOldReddit)
            return this.extractOldReddit(this.document);
          const r3 = this.document.querySelectorAll("shreddit-comment").length > 0;
          if (this.isCommentsPage() && !r3)
            return { content: "", contentHtml: "" };
          const n3 = this.getPostContent(), o2 = this.extractComments(), i2 = this.createContentHtml(n3, o2), s = ((e3 = (t3 = this.document.querySelector("h1")) === null || t3 === undefined ? undefined : t3.textContent) === null || e3 === undefined ? undefined : e3.trim()) || "", a = this.getSubreddit(), l = this.getPostAuthor(), c = this.createDescription(n3);
          return { content: i2, contentHtml: i2, extractedContent: { postId: this.getPostId(), subreddit: a, postAuthor: l }, variables: { title: s, author: l, site: `r/${a}`, description: c } };
        }
        extractOldReddit(t3) {
          var e3, r3, n3;
          const o2 = t3.querySelector(".thing.link"), i2 = ((r3 = (e3 = o2 == null ? undefined : o2.querySelector("a.title")) === null || e3 === undefined ? undefined : e3.textContent) === null || r3 === undefined ? undefined : r3.trim()) || "", s = (o2 == null ? undefined : o2.getAttribute("data-author")) || "", a = (o2 == null ? undefined : o2.getAttribute("data-subreddit")) || "", l = ((n3 = o2 == null ? undefined : o2.querySelector(".usertext-body .md")) === null || n3 === undefined ? undefined : n3.innerHTML) || "", c = t3.querySelector(".commentarea .sitetable"), u = c ? this.processOldRedditComments(c) : "", d = this.createContentHtml(l, u), m = this.createDescription(l);
          return { content: d, contentHtml: d, extractedContent: { postId: this.getPostId(), subreddit: a, postAuthor: s }, variables: { title: i2, author: s, site: `r/${a}`, description: m } };
        }
        getPostContent() {
          var t3, e3, r3, n3;
          return (((e3 = (t3 = this.shredditPost) === null || t3 === undefined ? undefined : t3.querySelector('[slot="text-body"]')) === null || e3 === undefined ? undefined : e3.innerHTML) || "") + (((n3 = (r3 = this.shredditPost) === null || r3 === undefined ? undefined : r3.querySelector("#post-image")) === null || n3 === undefined ? undefined : n3.outerHTML) || "");
        }
        createContentHtml(t3, e3) {
          return `
			<div class="reddit-post">
				<div class="post-content">
					${t3}
				</div>
			</div>
			${e3 ? `
				<hr>
				<h2>Comments</h2>
				<div class="reddit-comments">
					${e3}
				</div>
			` : ""}
		`.trim();
        }
        extractComments() {
          const t3 = Array.from(this.document.querySelectorAll("shreddit-comment"));
          return this.processComments(t3);
        }
        getPostId() {
          const t3 = this.url.match(/comments\/([a-zA-Z0-9]+)/);
          return (t3 == null ? undefined : t3[1]) || "";
        }
        getSubreddit() {
          const t3 = this.url.match(/\/r\/([^/]+)/);
          return (t3 == null ? undefined : t3[1]) || "";
        }
        getPostAuthor() {
          var t3;
          return ((t3 = this.shredditPost) === null || t3 === undefined ? undefined : t3.getAttribute("author")) || "";
        }
        createDescription(t3) {
          var e3;
          if (!t3)
            return "";
          const r3 = this.document.createElement("div");
          return r3.innerHTML = t3, ((e3 = r3.textContent) === null || e3 === undefined ? undefined : e3.trim().slice(0, 140).replace(/\s+/g, " ")) || "";
        }
        processOldRedditComments(t3) {
          return Array.from(t3.querySelectorAll(":scope > .thing.comment")).map((t4) => this.renderOldRedditComment(t4)).join("");
        }
        renderOldRedditComment(t3) {
          var e3, r3, n3;
          const o2 = t3.getAttribute("data-author") || "", i2 = t3.getAttribute("data-permalink") || "", s = ((r3 = (e3 = t3.querySelector(".entry .tagline .score.unvoted")) === null || e3 === undefined ? undefined : e3.textContent) === null || r3 === undefined ? undefined : r3.trim()) || "", a = t3.querySelector(".entry .tagline time[datetime]"), l = (a == null ? undefined : a.getAttribute("datetime")) || "";
          let c = "<blockquote>";
          c += `<div class="comment">
	<div class="comment-metadata">
		<span class="comment-author"><strong>${o2}</strong></span> •
		<a href="https://reddit.com${i2}" class="comment-link">${s}</a> •
		<span class="comment-date">${l ? new Date(l).toISOString().split("T")[0] : ""}</span>
	</div>
	<div class="comment-content">${((n3 = t3.querySelector(".entry .usertext-body .md")) === null || n3 === undefined ? undefined : n3.innerHTML) || ""}</div>
</div>`;
          const u = t3.querySelector(".child > .sitetable");
          if (u) {
            const t4 = Array.from(u.querySelectorAll(":scope > .thing.comment"));
            for (const e4 of t4)
              c += this.renderOldRedditComment(e4);
          }
          return c += "</blockquote>", c;
        }
        processComments(t3) {
          var e3;
          let r3 = "", n3 = -1, o2 = [];
          for (const i2 of t3) {
            const t4 = parseInt(i2.getAttribute("depth") || "0"), s = i2.getAttribute("author") || "", a = i2.getAttribute("score") || "0", l = i2.getAttribute("permalink") || "", c = ((e3 = i2.querySelector('[slot="comment"]')) === null || e3 === undefined ? undefined : e3.innerHTML) || "", u = i2.querySelector("faceplate-timeago"), d = (u == null ? undefined : u.getAttribute("ts")) || "", m = d ? new Date(d).toISOString().split("T")[0] : "";
            if (t4 === 0) {
              for (;o2.length > 0; )
                r3 += "</blockquote>", o2.pop();
              r3 += "<blockquote>", o2 = [0], n3 = 0;
            } else if (t4 < n3)
              for (;o2.length > 0 && o2[o2.length - 1] >= t4; )
                r3 += "</blockquote>", o2.pop();
            else
              t4 > n3 && (r3 += "<blockquote>", o2.push(t4));
            r3 += `<div class="comment">
	<div class="comment-metadata">
		<span class="comment-author"><strong>${s}</strong></span> •
		<a href="https://reddit.com${l}" class="comment-link">${a} points</a> •
		<span class="comment-date">${m}</span>
	</div>
	<div class="comment-content">${c}</div>
</div>`, n3 = t4;
          }
          for (;o2.length > 0; )
            r3 += "</blockquote>", o2.pop();
          return r3;
        }
      }
      e2.RedditExtractor = i;
    }, 968: (t2, e2, r2) => {
      Object.defineProperty(e2, "__esModule", { value: true }), e2.ContentScorer = undefined;
      const n2 = r2(640), o = ["admonition", "article", "content", "entry", "image", "img", "font", "figure", "figcaption", "pre", "main", "post", "story", "table"], i = ["advertisement", "all rights reserved", "banner", "cookie", "comments", "copyright", "follow me", "follow us", "footer", "header", "homepage", "login", "menu", "more articles", "more like this", "most read", "nav", "navigation", "newsletter", "newsletter", "popular", "privacy", "recommended", "register", "related", "responses", "share", "sidebar", "sign in", "sign up", "signup", "social", "sponsored", "subscribe", "subscribe", "terms", "trending"], s = /\b(linkedin\.com\/(in|company)\/|twitter\.com\/(?!intent\b)\w|x\.com\/(?!intent\b)\w|facebook\.com\/(?!share\b)\w|instagram\.com\/\w|threads\.net\/\w|mastodon\.\w)/i, a = ["advert", "ad-", "ads", "banner", "cookie", "copyright", "footer", "header", "homepage", "menu", "nav", "newsletter", "popular", "privacy", "recommended", "related", "rights", "share", "sidebar", "social", "sponsored", "subscribe", "terms", "trending", "widget"];

      class l {
        constructor(t3, e3 = false) {
          this.doc = t3, this.debug = e3;
        }
        static scoreElement(t3) {
          let e3 = 0;
          const r3 = t3.textContent || "", o2 = r3.split(/\s+/).length;
          e3 += o2;
          e3 += 10 * t3.getElementsByTagName("p").length;
          e3 -= 5 * (t3.getElementsByTagName("a").length / (o2 || 1));
          e3 -= 3 * (t3.getElementsByTagName("img").length / (o2 || 1));
          try {
            const r4 = t3.getAttribute("style") || "", n3 = t3.getAttribute("align") || "";
            (r4.includes("float: right") || r4.includes("text-align: right") || n3 === "right") && (e3 += 5);
          } catch (t4) {}
          /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i.test(r3) && (e3 += 10);
          /\b(?:by|written by|author:)\s+[A-Za-z\s]+\b/i.test(r3) && (e3 += 10);
          const i2 = t3.className.toLowerCase();
          (i2.includes("content") || i2.includes("article") || i2.includes("post")) && (e3 += 15);
          t3.querySelector(n2.FOOTNOTE_INLINE_REFERENCES) && (e3 += 10);
          t3.querySelector(n2.FOOTNOTE_LIST_SELECTORS) && (e3 += 10);
          if (e3 -= 5 * t3.getElementsByTagName("table").length, t3.tagName.toLowerCase() === "td") {
            const r4 = t3.closest("table");
            if (r4) {
              const n3 = parseInt(r4.getAttribute("width") || "0"), o3 = r4.getAttribute("align") || "", i3 = r4.className.toLowerCase();
              if (n3 > 400 || o3 === "center" || i3.includes("content") || i3.includes("article")) {
                const n4 = Array.from(r4.getElementsByTagName("td")), o4 = n4.indexOf(t3);
                o4 > 0 && o4 < n4.length - 1 && (e3 += 10);
              }
            }
          }
          return e3;
        }
        static findBestElement(t3, e3 = 50) {
          let r3 = null, n3 = 0;
          return t3.forEach((t4) => {
            const e4 = this.scoreElement(t4);
            e4 > n3 && (n3 = e4, r3 = t4);
          }), n3 > e3 ? r3 : null;
        }
        static scoreAndRemove(t3, e3 = false) {
          const r3 = Date.now();
          let o2 = 0;
          const i2 = new Set;
          Array.from(t3.querySelectorAll(n2.BLOCK_ELEMENTS.join(","))).forEach((t4) => {
            if (i2.has(t4))
              return;
            if (t4.closest("pre"))
              return;
            if (l.isLikelyContent(t4))
              return;
            l.scoreNonContentBlock(t4) < 0 && (i2.add(t4), o2++);
          }), i2.forEach((t4) => t4.remove());
          const s2 = Date.now();
          e3 && console.log("Defuddle", "Removed non-content blocks:", { count: o2, processingTime: `${(s2 - r3).toFixed(2)}ms` });
        }
        static isLikelyContent(t3) {
          const e3 = t3.getAttribute("role");
          if (e3 && ["article", "main", "contentinfo"].includes(e3))
            return true;
          const r3 = t3.className.toLowerCase(), n3 = t3.id.toLowerCase();
          for (const t4 of o)
            if (r3.includes(t4) || n3.includes(t4))
              return true;
          if (t3.querySelector("pre"))
            return true;
          const a2 = (t3.textContent || "").split(/\s+/).length;
          if (a2 < 200) {
            const e4 = t3.querySelectorAll("h1, h2, h3, h4, h5, h6");
            for (let t4 = 0;t4 < e4.length; t4++) {
              const r4 = (e4[t4].textContent || "").toLowerCase().trim();
              for (const t5 of i)
                if (r4.includes(t5))
                  return false;
            }
          }
          if (a2 < 80) {
            const e4 = t3.getElementsByTagName("a");
            for (let t4 = 0;t4 < e4.length; t4++) {
              const r4 = (e4[t4].getAttribute("href") || "").toLowerCase();
              if (s.test(r4))
                return false;
            }
          }
          const l2 = t3.getElementsByTagName("p").length;
          return a2 > 50 && l2 > 1 || (a2 > 100 || a2 > 30 && l2 > 0);
        }
        static scoreNonContentBlock(t3) {
          try {
            if (t3.matches(n2.FOOTNOTE_LIST_SELECTORS) || t3.querySelector(n2.FOOTNOTE_LIST_SELECTORS) || t3.closest(n2.FOOTNOTE_LIST_SELECTORS))
              return 0;
          } catch (t4) {}
          let e3 = 0;
          const r3 = t3.textContent || "", o2 = r3.split(/\s+/).length;
          if (o2 < 3)
            return 0;
          for (const t4 of i)
            r3.toLowerCase().includes(t4) && (e3 -= 10);
          const l2 = t3.getElementsByTagName("a"), c = l2.length;
          if (c / (o2 || 1) > 0.5 && (e3 -= 15), c > 1 && o2 < 80) {
            let t4 = 0;
            for (let e4 = 0;e4 < l2.length; e4++)
              t4 += (l2[e4].textContent || "").length;
            const n3 = r3.length;
            n3 > 0 && t4 / n3 > 0.8 && (e3 -= 15);
          }
          const u = t3.getElementsByTagName("ul").length + t3.getElementsByTagName("ol").length;
          if (u > 0 && c > 3 * u && (e3 -= 10), o2 < 80) {
            const r4 = t3.getElementsByTagName("a");
            for (let t4 = 0;t4 < r4.length; t4++) {
              const n3 = (r4[t4].getAttribute("href") || "").toLowerCase();
              if (s.test(n3)) {
                e3 -= 15;
                break;
              }
            }
          }
          const d = t3.className.toLowerCase(), m = t3.id.toLowerCase();
          for (const t4 of a)
            (d.includes(t4) || m.includes(t4)) && (e3 -= 8);
          return e3;
        }
      }
      e2.ContentScorer = l;
    } }, e = {};
    function r(n2) {
      var o = e[n2];
      if (o !== undefined)
        return o.exports;
      var i = e[n2] = { exports: {} };
      return t[n2].call(i.exports, i, i.exports, r), i.exports;
    }
    var n = {};
    return (() => {
      var t2 = n;
      const e2 = r(628);
      t2.default = e2.Defuddle;
    })(), n = n.default;
  })());
});

// src/page-to-markdown.ts
var import_defuddle = __toESM(require_dist(), 1);
var config = {
  url: "https://example.com/",
  output: {
    format: "ndjson"
  }
};
function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
function fallbackTitle(doc) {
  return clean(doc.find("title").first().text() || doc.find("h1").first().text());
}
function page_to_markdown_default({ doc, url }) {
  const title = fallbackTitle(doc);
  if (typeof document === "undefined") {
    return {
      url,
      title,
      extraction: "defuddle-core-unavailable",
      reason: "Flyscrape exposes a query wrapper as doc, not a browser DOM Document."
    };
  }
  const result = new import_defuddle.default(document, { url }).parse();
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
    markdown: result.content
  };
}
export {
  page_to_markdown_default as default,
  config
};
