import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import vm from "node:vm";

const cases = [
    { info: 'js title="app.js" start=98 hl=1,3-4', source: '/* multiline\n   comment */\n\nconst message = "<&>";\n', numbered: 4, active: 3 },
    { info: 'bash numbers=off', source: '  printf \'<>&"\\t\'\n\techo done  \n', numbered: 0, active: 0 },
    { info: 'bash', source: 'echo one\n', numbered: 0, active: 0 },
    { info: 'yaml', source: 'services:\n  web: true\n', numbered: 2, active: 0 },
    { info: 'json', source: '{\n  "value": 42\n}\n', numbered: 3, active: 0 },
    { info: 'powershell', source: '$value = "ok"\nWrite-Host $value\n', numbered: 2, active: 0 },
    { info: 'ini', source: '[service]\nenabled=true\n', numbered: 2, active: 0 },
    { info: 'diff-js', source: '-const value = 1;\n+const value = 2;\n', numbered: 2, active: 0 },
    { info: 'js/0,2', source: 'const a = 1;\nconst b = 2;\nconst c = 3;\n', numbered: 3, active: 0 },
    { info: 'text title="<unsafe>&name"', source: '<script>alert("x")</script>\n<img src=x onerror=alert(1)>\n', numbered: 2, active: 0 },
    { info: 'unknown', source: '<div>literal &amp; markup</div>\n\n', numbered: 2, active: 0 },
    { info: '', source: '  <tag> & text\n', numbered: 0, active: 0 },
    { info: 'js start=9999 hl=2', source: 'const long = "' + 'a'.repeat(500) + '";\nconst end = true;\n', numbered: 2, active: 1 },
];

// Exercise the actual Eleventy configuration, not a parallel test-only renderer.
test("build-time fences retain exact source, safe markup, numbers, highlights and Prism diff", async () => {
    await rm(".cache/code-fixtures", { recursive: true, force: true });
    await mkdir(".cache/code-fixtures", { recursive: true });
    await writeFile(".cache/code-fixtures/index.md", '---\nlayout: false\n---\n' + cases.map(item => `\n\`\`\`${item.info}\n${item.source}\`\`\`\n`).join(""));
    await writeFile(".cache/code-fixture-config.cjs", 'module.exports = config => { config.setUseGitIgnore(false); return require("../.eleventy.js")(config); };');
    execFileSync(process.execPath, ["node_modules/@11ty/eleventy/cmd.cjs", "--config=.cache/code-fixture-config.cjs", "--input=.cache/code-fixtures", "--output=.cache/code-output"], { stdio: "pipe", env: { ...process.env, BLOG_PRODUCTION: "false" } });
    const document = parseHTML(await readFile(".cache/code-output/index.html", "utf8")).document;
    const blocks = [...document.querySelectorAll("figure.code-block")];
    assert.equal(blocks.length, cases.length);
    for (const [index, block] of blocks.entries()) {
        const item = cases[index];
        assert.equal(block.querySelector("code").textContent, item.source, item.info);
        assert.equal(block.querySelectorAll(".line-number").length, item.numbered, item.info);
        assert.equal(block.querySelectorAll(".is-highlighted").length, item.active, item.info);
        for (const number of block.querySelectorAll(".line-number")) {
            assert.equal(number.getAttribute("aria-hidden"), "true");
            assert.equal(number.textContent, "");
        }
        assert.equal(block.querySelectorAll("pre button, code button").length, 0);
        assert.equal(block.querySelector("pre").getAttribute("tabindex"), "0");
        assert.ok(block.querySelector("figcaption .copy-button[hidden]"));
        if ([0, 3, 4, 5, 6, 7].includes(index)) assert.ok(block.querySelector(".token"), item.info);
    }
    assert.deepEqual([...blocks[0].querySelectorAll(".line-number")].map(el => el.dataset.line), ["98", "99", "100", "101"]);
    assert.equal(blocks[0].querySelector(".code-title").textContent, "app.js");
    assert.ok(blocks[7].querySelector(".token.inserted"));
    assert.ok(blocks[7].querySelector(".token.deleted"));
    assert.equal(blocks[8].querySelectorAll(".highlight-line-active").length, 2);
    assert.equal(blocks[9].querySelector(".code-title").textContent, "<unsafe>&name");
    assert.equal(document.querySelectorAll("script, img").length, 0);
    assert.equal(blocks[12].dataset.digits, "5");
});

test("copy enhancement copies text only, repeats, resets and handles clipboard rejection", async () => {
    const document = parseHTML('<figure class="code-block"><figcaption><button class="copy-button" hidden>Copy</button></figcaption><span class="copy-status" role="status"></span><pre><code><span class="line-number" aria-hidden="true" data-line="1"></span>  &lt;&amp;&gt;\n\tlast  \n</code></pre></figure>').document;
    let copied, scheduled;
    const navigator = { clipboard: { writeText: async text => { copied = text; } } };
    vm.runInNewContext(await readFile("src/assets/js/site.js", "utf8"), {
        document, navigator, clearTimeout: () => {}, setTimeout: callback => { scheduled = callback; },
    });
    const button = document.querySelector("button");
    const tick = () => new Promise(resolve => setImmediate(resolve));
    assert.equal(button.hidden, false);
    button.click(); await tick();
    assert.equal(copied, "  <&>\n\tlast  \n");
    assert.equal(button.textContent, "Copied");
    button.click(); await tick();
    assert.equal(button.textContent, "Copied");
    scheduled();
    assert.equal(button.textContent, "Copy");
    navigator.clipboard.writeText = async () => { throw new Error("denied"); };
    button.click(); await tick();
    assert.match(document.querySelector('[role="status"]').textContent, /Copy unavailable/);
});
