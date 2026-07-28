import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderDescriptionHtml } from "../viewer/src/math/renderDescription.ts";

describe("renderDescriptionHtml", () => {
  it("renders markdown structure and keeps math placeholders safe", () => {
    const html = renderDescriptionHtml(
      [
        "# Title",
        "",
        "See **bold** and $f_x$.",
        "",
        "| a | b |",
        "|---|---|",
        "| 1 | 2 |",
        "",
        "```js",
        "const x = 1",
        "```",
      ].join("\n"),
    );
    assert.match(html, /<h1>/);
    assert.match(html, /<strong>bold<\/strong>/);
    assert.match(html, /<table>/);
    assert.match(html, /<pre>/);
    assert.match(html, /katex|f_x|class="katex"/);
  });

  it("escapes raw HTML and blocks javascript links; drops images", () => {
    const html = renderDescriptionHtml(
      'Hi <script>alert(1)</script> [ok](https://example.com) [bad](javascript:alert(1)) ![x](https://example.com/a.png)',
    );
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /href="https:\/\/example\.com"/);
    assert.doesNotMatch(html, /javascript:/i);
    assert.doesNotMatch(html, /<img/i);
  });
});
