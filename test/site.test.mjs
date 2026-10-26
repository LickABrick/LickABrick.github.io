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

test("existing public URLs, listings and article bodies survive", async () => {
    const preserved = ["index.html", "notes/index.html", "posts/power-automate-powershell/index.html", "notes/debian-auto-updates/index.html"];
    for (const file of preserved) await access(path.join(output, file));
    for (const kind of ["posts", "notes"]) {
        const sources = (await files(`src/${kind}`)).filter(file => file.endsWith(".md"));
        const listing = await read(kind === "posts" ? "index.html" : "notes/index.html");
        for (const source of sources) {
            const slug = path.basename(source, ".md");
            const url = `/${kind}/${slug}/`;
            assert.ok(listing.includes(`href="${url}"`));
            const html = await read(`${kind}/${slug}/index.html`);
            const document = parseHTML(html).document;
            assert.ok(document.querySelector("article h1")?.textContent.trim());
            assert.ok(document.querySelector("article pre code"));
            assert.ok(document.querySelector(".token"), "Prism highlighting was generated");
            const metadata = await readFile(source, "utf8");
            const title = metadata.match(/^title: (.+)$/m)[1];
            const description = metadata.match(/^description: (.+)$/m)[1];
            assert.equal(document.querySelector("h1").textContent, title);
            assert.equal(document.querySelector('meta[name="description"]').content, description);
            assert.equal(document.querySelector('link[rel="canonical"]').href, site.url + url);
            assert.match(document.querySelector("time").getAttribute("datetime"), /^\d{4}-\d\d-\d\dT/);
        }
    }
});

test("all HTML pages have consistent, accessible, production metadata", () => {
    for (const { file, html, document } of documents) {
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
        const analytics = document.querySelector('script[data-website-id="b85f0592-1efc-4110-936d-54f3f07c1995"]');
        assert.equal(analytics.src, "https://umami.cl01.krokbv.com/script.js");
        assert.ok(analytics.hasAttribute("defer"));
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
    for (const rule of ["--color-theme-300:#78e2a0", "--color-shark-950:#1f222a", ".bg-theme-300", ".bg-shark-950", ".text-theme-300", ".flex-wrap", ".site-container", "overflow-x:auto", ":focus-visible", "@font-face"]) {
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
    assert.equal(sitemap.querySelectorAll("loc").length, htmlFiles.length);
    for (const { document } of documents) {
        assert.ok(sitemapText.includes(document.querySelector('link[rel="canonical"]').href));
    }
    assert.match(await read("robots.txt"), /User-agent: \*\nAllow: \//);
    assert.ok((await read("robots.txt")).includes(site.url + "/sitemap.xml"));
});
