import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { parseHTML, DOMParser } from "linkedom";

const site = JSON.parse(await readFile("src/_data/site.json", "utf8"));
const output = path.resolve("_site");
const read = file => readFile(path.join(output, file), "utf8");
async function files(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory()
        ? files(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const htmlFiles = (await files(output)).filter(file => file.endsWith(".html"));
const documents = await Promise.all(htmlFiles.map(async file => {
    const html = await readFile(file, "utf8");
    return { file, html, document: parseHTML(html).document };
}));

const publicDocuments = documents.filter(({ document }) => !document.querySelector('meta[http-equiv="refresh"]'));
const articles = publicDocuments.filter(({ document }) => document.querySelector("article"));

test("published articles appear in their archives with valid metadata", async () => {
    for (const { document } of articles) {
        const canonical = document.querySelector('link[rel="canonical"]').href;
        const url = new URL(canonical).pathname;
        const listing = await read(url.startsWith("/posts/") ? "posts/index.html" : "snippets/index.html");
        assert.ok(listing.includes(`href="${url}"`));
        assert.ok(document.querySelector("article h1").textContent.trim());
        assert.ok(document.querySelector('meta[name="description"]').content.trim());
        assert.match(document.querySelector("article time").getAttribute("datetime"), /^\d{4}-\d\d-\d\dT/);
    }
});

test("all HTML pages have consistent, accessible, production metadata", () => {
    for (const { file, html, document } of publicDocuments) {
        assert.match(html, /^<!DOCTYPE html>/i, file);
        assert.equal(document.documentElement.lang, "en");
        assert.equal(document.querySelectorAll("main").length, 1);
        assert.equal(document.querySelectorAll("h1").length, 1);
        assert.ok(document.querySelector('nav[aria-label="Primary"]'));
        assert.ok(document.querySelector('a[href="#main"]'));
        const canonical = site.url + "/" + path.relative(output, file).replace(/index\.html$/, "");
        assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1);
        assert.equal(document.querySelector('link[rel="canonical"]').href, canonical);
        assert.ok(document.title.endsWith(` | ${site.name}`));
        const description = document.querySelector('meta[name="description"]').content;
        assert.ok(description.length > 10);
        assert.equal(document.querySelector('meta[property="og:url"]').content, canonical);
        assert.equal(document.querySelector('meta[property="og:description"]').content, description);
        assert.equal(document.querySelector('meta[name="twitter:card"]').content, "summary");
        assert.equal(document.querySelectorAll('script[src="/assets/js/analytics.js"]').length, 0);
        for (const image of document.querySelectorAll("img")) assert.ok(image.alt?.trim());
        for (const link of document.querySelectorAll('a[target="_blank"]')) {
            assert.match(link.rel, /noopener|noreferrer/);
        }
    }
});

test("every local HTML link, fragment and asset resolves", async () => {
    for (const { file, document } of documents) {
        const pageUrl = new URL(path.relative(output, file), site.url + "/");
        for (const element of document.querySelectorAll("[href], [src]")) {
            const value = element.getAttribute("href") ?? element.getAttribute("src");
            const url = new URL(value, pageUrl);
            if (url.origin !== site.url) continue;
            let target = path.join(output, decodeURIComponent(url.pathname));
            if (!path.extname(target) || url.pathname.endsWith("/")) target = path.join(target, "index.html");
            await assert.doesNotReject(access(target), `${file}: missing ${value}`);
            if (url.hash && target.endsWith(".html")) {
                const targetDoc = parseHTML(await readFile(target, "utf8")).document;
                assert.ok(targetDoc.getElementById(decodeURIComponent(url.hash.slice(1))), `missing fragment: ${value}`);
            }
        }
    }
    // Include assets that are not directly referenced by an HTML document.
    for (const dir of ["images", "favicon", "fonts"]) {
        for (const source of await files(`src/assets/${dir}`)) {
            assert.deepEqual(await readFile(path.join(output, path.relative("src", source))), await readFile(source));
        }
    }
    const manifest = JSON.parse(await read("assets/favicon/site.webmanifest"));
    for (const icon of manifest.icons) await access(path.join(output, icon.src));
});

test("compiled CSS contains the palettes, Nunjucks utilities and readability rules", async () => {
    const css = await read("assets/css/tailwind.css");
    assert.ok(css.length > 5000);
    assert.ok(!css.includes('@import "tailwindcss"'));
    for (const rule of ["--color-theme-300:#78e2a0", "--color-shark-950:#1f222a", ".bg-shark-950", ".site-container", "overflow-x:auto", ":focus-visible", "@font-face"]) {
        assert.ok(css.includes(rule), rule);
    }
    assert.match(await read("assets/css/prism-theme.css"), /\.token\.keyword/);
});

test("RSS, sitemap and robots expose only canonical production URLs", async () => {
    const parser = new DOMParser();
    const feedText = await read("feed.xml");
    const sitemapText = await read("sitemap.xml");
    assert.ok(feedText.startsWith("<?xml"));
    assert.ok(sitemapText.startsWith("<?xml"));
    const feed = parser.parseFromString(feedText, "text/xml");
    const sitemap = parser.parseFromString(sitemapText, "text/xml");
    const posts = (await files("src/posts")).filter(file => file.endsWith(".md"));
    assert.equal(feed.querySelectorAll("item").length, posts.length);
    for (const item of feed.querySelectorAll("item")) {
        assert.ok(item.querySelector("link").textContent.startsWith(site.url + "/posts/"));
        assert.ok(!Number.isNaN(Date.parse(item.querySelector("pubDate").textContent)));
        assert.equal(item.querySelector("guid").textContent, item.querySelector("link").textContent);
    }
    assert.equal(sitemap.querySelectorAll("loc").length, publicDocuments.length);
    for (const { document } of publicDocuments) {
        assert.ok(sitemapText.includes(document.querySelector('link[rel="canonical"]').href));
    }
    assert.match(await read("robots.txt"), /User-agent: \*\nAllow: \//);
    assert.ok((await read("robots.txt")).includes(site.url + "/sitemap.xml"));
});


test("legacy aliases redirect to canonical snippets and are not indexed", async () => {
    const sitemap = await read("sitemap.xml");
    for (const [legacy, target] of [["snippets/linux/debian-auto-updates/index.html", "/snippets/debian-auto-updates/"], ["snippets/certificates/pfx-to-crt-key/index.html", "/snippets/pfx-to-crt-key/"], ["notes/index.html", "/snippets/"], ["notes/debian-auto-updates/index.html", "/snippets/debian-auto-updates/"]]) {
        const doc = parseHTML(await read(legacy)).document;
        assert.equal(doc.querySelector('link[rel="canonical"]').href, site.url + target);
        assert.equal(doc.querySelector('meta[name="robots"]').content, "noindex, follow");
        assert.equal(doc.querySelector('meta[http-equiv="refresh"]').content, "0;url=" + target);
        assert.equal(doc.querySelector("a").href, target);
        const destination = parseHTML(await read(target.slice(1) + "index.html")).document;
        assert.equal(destination.querySelector('meta[http-equiv="refresh"]'), null);
        assert.ok(!sitemap.includes(site.url + "/" + legacy.replace("index.html", "")));
    }
    assert.ok(!sitemap.includes("/notes/"));
});

for (const type of ["post", "snippet"]) test(`${type} index covers all published entries with public tags and searchable text`, async () => {
    const index = JSON.parse(await read(`${type}-search.json`));
    const archive = parseHTML(await read(`${type}s/index.html`)).document;
    const urls = [...archive.querySelectorAll("[data-content-url]")].map(el => el.dataset.contentUrl).sort();
    assert.deepEqual(index.map(item => item.url).sort(), urls);
    for (const item of index) {
        assert.ok(item.text.length);
        assert.ok(Array.isArray(item.tags));
        assert.ok(!("category" in item));
        assert.ok(!item.tags.some(tag => ["post", "snippet", "page"].includes(tag)));
        const doc = parseHTML(await read(item.url.slice(1) + "index.html")).document;
        assert.deepEqual([...doc.querySelectorAll("article header .tags a")].map(a => a.href.split("/")[2]), item.tags);
    }
    // Existing command references must remain discoverable regardless of new content.
    if (type === "snippet") assert.ok(index.some(item => item.text.includes("openssl pkcs12")));
    if (type === "snippet") assert.ok(index.some(item => item.text.includes("apt-daily.timer")));
});

test("article date display agrees with structured metadata", () => {
    for (const { document } of articles) {
        const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
        assert.equal(document.querySelector("article header time").getAttribute("datetime"), schema.datePublished);
        const updated = document.querySelector('meta[property="article:modified_time"]');
        assert.equal(updated?.content, schema.dateModified);
        if (schema.dateModified) assert.ok(new Date(schema.dateModified) > new Date(schema.datePublished));
    }
});
