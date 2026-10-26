const { parseHTML } = require("linkedom");

const escape = text => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Fence info: js title="app.js" start=10 hl=1,3-5 numbers=off
// hl uses one-based positions, independent of start. Existing js/0,2-3 and
// diff-js fences retain the syntaxhighlight plugin's zero-based/diff syntax.
function splitLines(node) {
    if (node.nodeType === 3) return node.textContent.split("\n").map(escape);
    const lines = [""];
    for (const child of node.childNodes) {
        const parts = splitLines(child);
        lines[lines.length - 1] += parts[0];
        lines.push(...parts.slice(1));
    }
    if (node.localName === "code") return lines;
    const attributes = [...node.attributes].map(attr => ` ${attr.name}="${escape(attr.value)}"`).join("");
    return lines.map(line => `<${node.localName}${attributes}>${line}</${node.localName}>`);
}

module.exports = function codeBlocks(md) {
    md.renderer.rules.fence = (tokens, index) => {
        const token = tokens[index];
        const [language = "text"] = token.info.trim().split(/\s+/);
        const metadata = token.info.slice(language.length).trim();
        const title = metadata.match(/(?:^|\s)title="([^"]*)"/)?.[1];
        const startValue = metadata.match(/(?:^|\s)start=(\d+)(?:\s|$)/)?.[1];
        const start = Number(startValue || 1);
        if (!Number.isSafeInteger(start) || start < 1 || start > 1000000000) throw new Error("Invalid code fence start");
        const selection = metadata.match(/(?:^|\s)hl=([\d,-]+)(?:\s|$)/)?.[1] || "";
        const ranges = selection.split(",").filter(Boolean).map(range => {
            const [first, last = first] = range.split("-").map(Number);
            if (!first || !last || last < first) throw new Error("Invalid code fence highlight range");
            return [first, last];
        });
        const source = token.content;
        // Retain Prism's full-block tokenization, including multiline comments.
        const html = md.options.highlight(source, language);
        const code = parseHTML(html || "<pre><code></code></pre>").document.querySelector("code");
        const expected = source.endsWith("\n") ? source.slice(0, -1) : source;
        // The upstream plaintext/unknown-language path does not escape HTML.
        // Only accept its markup when it round-trips to the original source.
        let lines;
        if (code && (code.textContent === expected || code.textContent === source)) {
            lines = splitLines(code);
            if (code.textContent === source && source.endsWith("\n")) lines.pop();
        } else {
            lines = expected.split("\n").map(escape);
        }
        const numbered = lines.length > 1 && !/(?:^|\s)numbers=off(?:\s|$)/.test(metadata);
        const digits = String(start + lines.length - 1).length;
        lines = lines.map((line, i) => `<span class="code-line${ranges.some(([a, b]) => i + 1 >= a && i + 1 <= b) ? " is-highlighted" : ""}">${numbered ? `<span class="line-number" aria-hidden="true" data-line="${start + i}"></span>` : ""}<span class="line-source">${line}</span></span>`);
        const label = language.split("/")[0] || "text";
        return `<figure class="code-block${numbered ? " has-line-numbers" : ""}" data-digits="${digits}"><figcaption class="code-toolbar"><span class="code-label">${escape(label)}${title ? ` <span class="code-title">${escape(title)}</span>` : ""}</span><button class="copy-button" type="button" hidden>Copy</button></figcaption><span class="copy-status" role="status"></span><pre tabindex="0" aria-label="${escape(title || label)} code"><code class="language-${escape(label)}">${lines.join("\n")}${source.endsWith("\n") ? "\n" : ""}</code></pre></figure>\n`;
    };
};
