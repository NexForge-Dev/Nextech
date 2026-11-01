import { describe, it, expect } from "vitest";
import { renderMarkdownSafe } from "@/lib/security/sanitize";

describe("renderMarkdownSafe", () => {
  it("strips script tags", () => expect(renderMarkdownSafe("oi <script>alert(1)</script>")).not.toContain("<script"));
  it("strips event handlers", () => expect(renderMarkdownSafe('<img src=x onerror="alert(1)">')).not.toContain("onerror"));
  it("strips javascript: links", () => expect(renderMarkdownSafe("[x](javascript:alert(1))")).not.toContain("javascript:"));
  it("keeps strong", () => expect(renderMarkdownSafe("**forte**")).toContain("<strong>forte</strong>"));
  it("hardens https links", () => {
    const html = renderMarkdownSafe("[loja](https://loja.com)");
    expect(html).toContain('rel="nofollow noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });
  it("drops http links' href", () => expect(renderMarkdownSafe("[x](http://loja.com)")).not.toContain('href="http://'));
});
