import assert from "node:assert/strict";
import { readFile, readdir, rm, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import vm from "node:vm";

async function htmlFiles(dir) {
    return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(entry => entry.isDirectory()
        ? htmlFiles(path.join(dir, entry.name)) : entry.name.endsWith(".html") ? [path.join(dir, entry.name)] : []))).flat();
}

test("analytics is explicit production-only; initialization is safe and singular", async () => {
    const script = await readFile("src/assets/js/analytics.js", "utf8");
    for (const mode of ["false", "preview", "true"]) {
        const dir = `.cache/analytics-${mode}`;
        await rm(dir, { recursive: true, force: true });
        execFileSync(process.execPath, ["node_modules/@11ty/eleventy/cmd.cjs", `--output=${dir}`], {
            env: { ...process.env, BLOG_PRODUCTION: mode }, stdio: "pipe",
        });
        if (mode !== "true") await assert.rejects(access(path.join(dir, "assets/js/analytics.js")));
        else await access(path.join(dir, "assets/js/analytics.js"));
        for (const file of await htmlFiles(dir)) {
            const html = await readFile(file, "utf8");
            const document = parseHTML(html).document;
            const alias = Boolean(document.querySelector('meta[http-equiv="refresh"]'));
            assert.ok(!/umami/i.test(html));
            assert.equal(document.querySelectorAll('script[src="/assets/js/analytics.js"]').length, mode === "true" && !alias ? 1 : 0);
            assert.ok(!/clientSecret|sessionReplay|identify\(/.test(html + script));
        }
    }
    let appended = [];
    const context = {
        URL, window: {}, navigator: {}, location: { search: "", hash: "" },
        document: { createElement: () => ({}), head: { append: element => appended.push(element) } },
    };
    vm.runInNewContext(script, context);
    assert.equal(appended.length, 1);
    assert.equal(appended[0].src, "https://openpanel.dev/op1.js");
    assert.equal(context.window.op.q.length, 1);
    assert.equal(context.window.op.q[0][0], "init");
    assert.deepEqual(JSON.parse(JSON.stringify(context.window.op.q[0][1])), {
        apiUrl: "https://analytics.krokbv.com/api", clientId: "566c6043-b91d-4f0e-87ea-2019b1e3efcd",
        trackScreenViews: true, trackOutgoingLinks: true, trackAttributes: false,
    });
    const event = { payload: { properties: { __path: "https://example.com/page/?token=secret#x", __referrer: "https://search.example/private?q=secret", href: "https://example.org/?secret=x" } } };
    assert.equal(context.window.op.q[0][1].filter(event), true);
    assert.deepEqual(event.payload.properties, { __path: "https://example.com/page/", __referrer: "https://search.example", href: "https://example.org/" });
    for (const overrides of [{ navigator: { doNotTrack: "1" } }, { navigator: { globalPrivacyControl: true } }, { location: { search: "?sensitive=1" } }]) {
        appended = [];
        vm.runInNewContext(script, { ...context, window: {}, ...overrides });
        assert.equal(appended.length, 0);
    }
});
