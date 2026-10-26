import assert from "node:assert/strict";
import { mkdtemp, cp, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";

test("future content automatically gets search, tags and flat URLs; explicit permalinks survive tag changes", async () => {
    const root = await mkdtemp(path.resolve(".cache/future-"));
    const src = path.join(root, "src");
    const output = path.join(root, "output");
    const build = () => execFileSync(process.execPath, ["node_modules/@11ty/eleventy/cmd.cjs", `--input=${src}`, `--output=${output}`], { stdio: "pipe", env: { ...process.env, BLOG_PRODUCTION: "false" } });
    try {
        await cp("src", src, { recursive: true });
        // Directory data resolves its helper relative to the copied source tree.
        await cp("lib", path.join(root, "lib"), { recursive: true });
        const content = (type, extra = "") => `---\ntitle: Future ${type}\ndescription: Synthetic future content\ndate: 2025-01-01\ntags: [future-topic]\n${extra}---\nBodyOnlyNeedle command --flag\n`;
        await writeFile(path.join(src, "posts/future.md"), content("Post"));
        const snippet = path.join(src, "snippets/future.md");
        await writeFile(snippet, content("Snippet"));
        build();
        for (const type of ["post", "snippet"]) {
            const index = JSON.parse(await readFile(path.join(output, `${type}-search.json`), "utf8"));
            const entry = index.find(item => item.text.includes("bodyonlyneedle"));
            assert.ok(entry);
            assert.deepEqual(entry.tags, ["future-topic"]);
            if (type === "snippet") assert.equal(entry.url, "/snippets/future/");
        }
        assert.ok((await readFile(path.join(output, "tags/future-topic/index.html"), "utf8")).includes("Future Post"));
        await writeFile(snippet, content("Snippet", "permalink: /snippets/stable/\n").replace("future-topic", "changed-topic"));
        build();
        assert.ok((await readFile(path.join(output, "snippets/stable/index.html"), "utf8")).includes("Future Snippet"));
        await writeFile(path.join(src, "snippets/duplicate.md"), content("Duplicate", "permalink: /snippets/stable/\n"));
        assert.throws(build, error => /stable/.test(String(error.stderr)) && /duplicate\.md/.test(String(error.stderr)) && /future\.md/.test(String(error.stderr)));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
