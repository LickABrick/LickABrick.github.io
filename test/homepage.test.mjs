import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createRequire } from "node:module";
import { parseHTML } from "linkedom";
const require = createRequire(import.meta.url);
const nunjucks = require("nunjucks");
const configure = require("../.eleventy.js");
const filters = {};
configure({
    addFilter: (name, fn) => { filters[name] = fn; },
    addCollection() {}, addPassthroughCopy() {}, addWatchTarget() {}, addPlugin() {}, amendLibrary() {},
});
const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(["src", "src/_includes"]), { autoescape: true });
for (const [name, fn] of Object.entries(filters)) env.addFilter(name, fn);
const item = (kind, index) => ({
    date: new Date(`2020-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`),
    url: `/${kind}/${index}/`,
    data: { title: `${kind} ${index}`, description: `Description ${index}`, tags: [kind === "posts" ? "post" : "snippet"] },
});

test("homepage renders five newest of each kind with correct hierarchy and compact snippets", () => {
    const posts = Array.from({ length: 8 }, (_, i) => item("posts", i));
    const snippets = Array.from({ length: 7 }, (_, i) => item("snippets", i));
    const doc = parseHTML(env.render("index.njk", { description: "Infrastructure, automation and things I build.", collections: { post: posts, snippet: snippets } })).document;
    assert.equal(doc.querySelectorAll("h1").length, 1);
    assert.notEqual(doc.querySelector("h1").textContent, "LickABrick_");
    for (const [id, expected] of [["recent-posts", [7, 6, 5, 4, 3]], ["recent-snippets", [6, 5, 4, 3, 2]]]) {
        const section = doc.querySelector(`#${id}`).parentElement.parentElement;
        assert.deepEqual([...section.querySelectorAll(".entry h3 a")].map(a => Number(a.href.split("/")[2])), expected);
        assert.equal(section.querySelectorAll(".entry h2").length, 0);
    }
    assert.equal(doc.querySelector('a[href="/posts/"]').textContent, "View all Posts");
    assert.equal(doc.querySelector('a[href="/snippets/"]').textContent, "View all Snippets");
    assert.equal(doc.querySelectorAll(".entry-compact .meta").length, 0);
    assert.ok(!doc.querySelector(".entry-compact").textContent.includes("Description"));
    assert.equal(doc.querySelectorAll(".tags").length, 0, "collection-only tags do not create empty labels");
});

test("empty/small collections and full archive remain server-rendered and predictable", () => {
    const empty = parseHTML(env.render("index.njk", { collections: { post: [], snippet: [] } })).document;
    assert.equal(empty.querySelectorAll(".index-section, .entry").length, 0);
    assert.ok([...empty.querySelectorAll("p")].some(p => p.textContent.includes("No entries published yet")));
    const small = parseHTML(env.render("index.njk", { collections: { post: [item("posts", 0)], snippet: [] } })).document;
    assert.equal(small.querySelectorAll(".entry").length, 1);
    assert.equal(small.querySelectorAll("#recent-snippets").length, 0);
    const posts = Array.from({ length: 8 }, (_, i) => item("posts", i));
    const archive = parseHTML(env.render("posts.njk", { collections: { post: posts } })).document;
    assert.equal(archive.querySelectorAll(".entry").length, 8);
    assert.equal(archive.querySelector(".entry h2 a").href, "/posts/7/");
    for (const template of ["posts.njk", "snippets.njk"]) {
        const doc = parseHTML(env.render(template, { collections: { post: [], snippet: [] } })).document;
        assert.equal(doc.querySelectorAll(".entry").length, 0);
        assert.match(doc.querySelector(".entry-list").textContent, /No (posts|snippets) published yet/);
    }
});

test("optional metadata displays meaningful updates and tags consistently", () => {
    const entry = item("posts", 1);
    entry.data.last_modified = "2020-02-01";
    entry.data.tags = ["post", "powershell"];
    const doc = parseHTML(env.renderString('{% from "partials/entry.njk" import render %}{{ render(entry, "post", "full", 2) }}', { entry })).document;
    assert.match(doc.querySelector(".meta").textContent, /Published.*Updated/s);
    assert.equal(doc.querySelectorAll("time").length, 2);
    assert.equal(doc.querySelector(".tags").textContent, "#PowerShell");
    entry.data.last_modified = "2020-01-01";
    const unchanged = parseHTML(env.renderString('{% from "partials/entry.njk" import render %}{{ render(entry) }}', { entry })).document;
    assert.equal(unchanged.querySelectorAll("time").length, 1);
    assert.ok(!unchanged.querySelector(".meta").textContent.includes("Updated"));
    entry.data.tags = ['<img src=x onerror="alert(1)">', "linux", "debian"];
    const compact = parseHTML(env.renderString('{% from "partials/entry.njk" import render %}{{ render(entry, "snippet", "compact", 3) }}', { entry })).document;
    assert.equal(compact.querySelectorAll(".tags a").length, 2);
    assert.equal(compact.querySelectorAll("img").length, 0);
    assert.ok(compact.querySelector(".tags a").textContent.includes("<img"));
});

test("generated homepage/archive navigation and canonical URLs are distinct", async () => {
    const home = parseHTML(await readFile("_site/index.html", "utf8")).document;
    const archive = parseHTML(await readFile("_site/posts/index.html", "utf8")).document;
    const snippets = parseHTML(await readFile("_site/snippets/index.html", "utf8")).document;
    assert.ok(home.querySelector("#recent-posts"));
    assert.ok(home.querySelector("#recent-snippets"));
    assert.equal(home.querySelectorAll('nav a[aria-current="page"]').length, 0);
    assert.equal(archive.querySelector('nav a[aria-current="page"]').href, "/posts/");
    assert.equal(snippets.querySelector('nav a[aria-current="page"]').href, "/snippets/");
    assert.notEqual(home.querySelector('link[rel="canonical"]').href, archive.querySelector('link[rel="canonical"]').href);
    assert.equal(home.querySelectorAll(".entry-compact").length, Math.min(5, snippets.querySelectorAll(".entry").length));
    for (const link of archive.querySelectorAll(".entry h2 a")) {
        const article = parseHTML(await readFile(`_site${link.href}index.html`, "utf8")).document;
        const expected = [...link.closest(".entry").querySelectorAll(".tags a")].map(tag => tag.href);
        assert.deepEqual([...article.querySelectorAll("article header .tags a")].map(tag => tag.href), expected);
    }
});
