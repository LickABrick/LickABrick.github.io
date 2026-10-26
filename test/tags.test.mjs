import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createRequire } from "node:module";
import { parseHTML } from "linkedom";
const require = createRequire(import.meta.url);
const { publicTags, tagCatalog } = require("../lib/tags.cjs");

test("tags normalize case, whitespace, duplicates and safe slugs; collisions fail", () => {
    const tags = publicTags([" PowerShell ", "powershell", "POST", "snippet", "page", "", "  ", "microsoft-365", "C++", "Café"]);
    assert.deepEqual(tags.map(tag => tag.slug), ["powershell", "microsoft-365", "c", "cafe"]);
    assert.equal(tags[0].label, "PowerShell");
    assert.deepEqual(publicTags(null), []);
    assert.throws(() => publicTags(["C++", "C#"]), /collision/);
    assert.throws(() => publicTags(["!!!"]), /URL-safe/);
    for (const tag of publicTags(['<script>alert("x")</script>', "a/b?c=d"])) assert.match(tag.url, /^\/tags\/[a-z0-9-]+\/$/);
    const item = (tags, date, url) => ({ data: { tags }, date: new Date(date), url });
    const post = item(["post", "Shared", "shared"], "2020-01-01", "/posts/a/");
    const snippet = item(["snippet", "SHARED"], "2021-01-01", "/snippets/b/");
    const newer = item(["post", "shared"], "2022-01-01", "/posts/c/");
    const catalog = tagCatalog([post, snippet, newer]);
    assert.equal(catalog.length, 1);
    assert.deepEqual(catalog[0].posts, [newer, post]);
    assert.deepEqual(catalog[0].snippets, [snippet]);
    assert.deepEqual(tagCatalog([]), []);
    assert.throws(() => tagCatalog([item(["post", "a b"], "2020-01-01"), item(["snippet", "a-b"], "2020-01-02")]), /collision/);
});

test("every generated public tag archive has exact members, SEO, sorting and sitemap entry", async () => {
    const site = JSON.parse(await readFile("src/_data/site.json", "utf8"));
    const members = new Map();
    for (const type of ["posts", "snippets"]) {
        const archive = parseHTML(await readFile(`_site/${type}/index.html`, "utf8")).document;
        for (const link of archive.querySelectorAll(".entry h2 a")) {
            const doc = parseHTML(await readFile(`_site${link.href}index.html`, "utf8")).document;
            for (const tag of doc.querySelectorAll("article header .tags a")) {
                if (!members.has(tag.href)) members.set(tag.href, { posts: [], snippets: [] });
                members.get(tag.href)[type].push({ url: link.href, date: doc.querySelector("article time").getAttribute("datetime") });
            }
        }
    }
    const sitemap = await readFile("_site/sitemap.xml", "utf8");
    for (const [url, groups] of members) {
        const doc = parseHTML(await readFile(`_site${url}index.html`, "utf8")).document;
        assert.equal(doc.querySelectorAll("h1").length, 1);
        assert.equal(doc.querySelector('link[rel="canonical"]').href, site.url + url);
        assert.equal(doc.querySelector('meta[property="og:url"]').content, site.url + url);
        assert.ok(doc.querySelector('meta[name="description"]').content.includes(doc.querySelector("h1").textContent));
        assert.equal(doc.querySelectorAll('nav [aria-current="page"]').length, 0);
        assert.ok(sitemap.includes(site.url + url));
        for (const type of ["posts", "snippets"]) {
            const expected = groups[type].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).map(item => item.url);
            const section = doc.querySelector(`#tag-${type}`)?.parentElement.parentElement;
            assert.deepEqual(section ? [...section.querySelectorAll(".entry h3 a")].map(a => a.href) : [], expected);
            assert.equal(new Set(expected).size, expected.length);
            assert.equal(Boolean(section), expected.length > 0);
        }
    }
    for (const tag of ["post", "snippet", "page"]) assert.ok(!sitemap.includes(`/tags/${tag}/`));
});
