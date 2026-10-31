import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li", "h2", "h3", "h4", "a", "table", "thead", "tbody", "tr", "th", "td", "blockquote", "code"];

/** Markdown → sanitized HTML. Only https links survive; they open in a new tab with nofollow. */
export function renderMarkdownSafe(md: string): string {
  const html = marked.parse(md ?? "", { async: false, gfm: true, breaks: true }) as string;
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "rel", "target"] },
    allowedSchemes: ["https"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: (attribs.href?.startsWith("https://")
          ? { href: attribs.href, rel: "nofollow noopener noreferrer", target: "_blank" }
          : {}) as Record<string, string>,
      }),
      b: "strong",
      i: "em",
      h1: "h2",
    },
  });
}

/** Plain text, no HTML at all (for meta descriptions, CSV, etc.). */
export function stripTags(input: string): string {
  return sanitizeHtml(input ?? "", { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
