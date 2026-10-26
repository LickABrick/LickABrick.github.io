import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const { tagCatalog, frequentTags } = require("../lib/tags.cjs");
const { snippetPermalink, validateSnippetUrls } = require("../lib/snippet-urls.cjs");

test("tag usage counts, deterministic ranking and homepage limit grow with content", () => {
    const item = tags => ({ data: { tags }, date: new Date() });
    const catalog = tagCatalog([item(["post", "linux", "LINUX", "automation"]), item(["snippet", "linux"]), item(["post", "alpha"])]);
    assert.equal(catalog.find(t => t.slug === "linux").count, 2);
    assert.deepEqual(frequentTags(catalog).map(t => t.slug), ["linux", "alpha", "automation"]);
    assert.equal(frequentTags(tagCatalog(Array.from({ length: 12 }, (_, i) => item([`topic-${i}`])))).length, 8);
    assert.deepEqual(frequentTags([]), []);
});

test("flat snippet defaults, slug overrides and collision diagnostics", () => {
    const data = { page: { fileSlug: "new-command", inputPath: "src/snippets/new-command.md" }, tags: ["linux"] };
    assert.equal(snippetPermalink(data), "/snippets/new-command/");
    assert.equal(snippetPermalink({ ...data, tags: ["other"] }), snippetPermalink(data));
    assert.equal(snippetPermalink({ ...data, slug: "stable-command" }), "/snippets/stable-command/");
    assert.throws(() => snippetPermalink({ ...data, slug: "../unsafe" }), /slug/);
    assert.throws(() => validateSnippetUrls([{ url: "/snippets/install/", inputPath: "a.md" }, { url: "/snippets/install/", inputPath: "b.md" }]), /Duplicate.*a.md and b.md/);
});

test("tag directory is complete, homepage is capped, forms are associated and shared", async () => {
    const doc = parseHTML(await readFile("_site/tags/index.html", "utf8")).document;
    const links = [...doc.querySelectorAll(".topic-links a")].map(a => a.href);
    const expectedTags = new Map();
    const home = parseHTML(await readFile("_site/index.html", "utf8")).document;
    assert.ok(home.querySelectorAll(".topic-links a").length <= 8);
    for (const link of home.querySelectorAll(".topic-links a")) assert.ok(links.includes(link.href));
    for (const type of ["posts", "snippets"]) {
        const archive = parseHTML(await readFile(`_site/${type}/index.html`, "utf8")).document;
        assert.ok(archive.querySelector('script[src="/assets/js/content-search.js"]'));
        const used = new Set();
        for (const entry of archive.querySelectorAll(".entry")) {
            for (const link of entry.querySelectorAll(".tags a")) {
                used.add(link.href);
                expectedTags.set(link.href, (expectedTags.get(link.href) || 0) + 1);
            }
        }
        assert.deepEqual([...archive.querySelectorAll("select option")].map(option => option.value).filter(Boolean).sort(), [...used].map(url => url.split("/")[2]).sort());
        const ids = [...archive.querySelectorAll("[id]")].map(el => el.id);
        assert.equal(new Set(ids).size, ids.length);
        assert.equal(archive.querySelector("form").hidden, true);
        for (const control of archive.querySelectorAll("form input, form select")) {
            assert.ok(archive.querySelector(`label[for="${control.id}"]`));
            assert.ok(archive.getElementById(control.getAttribute("aria-controls")));
        }
    }
    assert.deepEqual(links.slice().sort(), [...expectedTags.keys()].sort());
    for (const link of doc.querySelectorAll(".topic-links a")) {
        assert.ok(link.parentElement.textContent.includes(`(${expectedTags.get(link.href)})`));
    }
    const css = await readFile("src/assets/css/tailwind.css", "utf8");
    assert.ok(css.includes("--filter-control-height: 44px"));
    assert.ok(css.includes("height: var(--filter-control-height)"));
    assert.ok(css.includes("box-sizing: border-box"));
});

test("tag search filters names safely and resets without network requests", async () => {
    const { document, window } = parseHTML('<div data-tag-directory><form hidden><input><button type="reset">Reset</button></form><p role="status" hidden></p><ul><li data-tag-name="linux">Linux</li><li data-tag-name="powershell PowerShell">PowerShell</li></ul></div>');
    const query = document.querySelector("input");
    let pending;
    vm.runInNewContext(await readFile("src/assets/js/tag-search.js", "utf8"), { document, setTimeout: fn => { pending = fn; }, clearTimeout() {} });
    const input = value => { query.value = value; query.dispatchEvent(new window.Event("input")); pending(); };
    input("  PoWeRsHeLl  ");
    assert.deepEqual([...document.querySelectorAll("li")].filter(el => !el.hidden).map(el => el.textContent), ["PowerShell"]);
    input("<img src=x>");
    assert.equal(document.querySelectorAll("img").length, 0);
    assert.match(document.querySelector("p").textContent, /No tags/);
    document.querySelector("form").dispatchEvent(new window.Event("reset"));
    assert.equal([...document.querySelectorAll("li")].filter(el => !el.hidden).length, 2);
});
