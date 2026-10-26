import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import vm from "node:vm";

for (const type of ["post", "snippet"]) test(`${type} search uses all terms and exact tags; URL state, history, reset and failures are safe`, async () => {
    const { document, window } = parseHTML('<div data-content-search="snippet" data-index="/snippet-search.json"><form hidden><input id="query"><select id="tag"><option value="">All</option><option value="linux">Linux</option><option value="certificates">Certificates</option></select><button type="reset">Reset</button></form><p role="status" hidden></p><section data-content-url="/a/"></section><section data-content-url="/b/"></section></div>');
    document.querySelector("[data-content-search]").dataset.contentSearch = type;
    document.querySelector("[data-content-search]").dataset.index = `/${type}-search.json`;
    const form = document.querySelector("form"), query = document.querySelector("input"), tag = document.querySelector("select");
    // Linkedom lacks writable select.value; model the native selection contract.
    let selected = "";
    Object.defineProperty(tag, "value", { get: () => selected, set: value => { selected = value; } });
    const location = { href: "https://example.com/snippets/?keep=yes&tag=linux&tag=certificates" };
    const states = [location.href]; let position = 0;
    const history = {
        pushState(_state, _title, url) { location.href = String(url); states.splice(++position); states.push(location.href); },
        replaceState(_state, _title, url) { location.href = String(url); states[position] = location.href; },
    };
    let scheduled;
    const script = await readFile("src/assets/js/content-search.js", "utf8");
    vm.runInNewContext(script, { document, window, location, history, URL,
        setTimeout: callback => { scheduled = callback; }, clearTimeout: () => {},
        fetch: async endpoint => { assert.equal(endpoint, `/${type}-search.json`); return ({ ok: true, json: async () => [
            { url: "/a/", text: "Linux apt update", tags: ["linux"] },
            { url: "/b/", text: "OpenSSL pkcs12 PFX", tags: ["certificates", "linux-extra"] },
        ] }); },
    });
    await new Promise(resolve => setImmediate(resolve));
    const visible = () => [...document.querySelectorAll("section")].filter(el => !el.hidden).map(el => el.dataset.contentUrl);
    const dispatch = (el, event) => el.dispatchEvent(new window.Event(event));
    assert.deepEqual(visible(), ["/a/"]);
    tag.value = "certificates"; dispatch(tag, "change");
    query.value = "OPENSSL pkcs12"; dispatch(query, "input"); scheduled();
    assert.deepEqual(visible(), ["/b/"]);
    const length = states.length;
    query.value = "openssl pfx"; dispatch(query, "input"); scheduled();
    assert.equal(states.length, length, "keystrokes replace one editing-session entry");
    assert.equal(new URL(location.href).searchParams.get("keep"), "yes");
    position--; location.href = states[position]; dispatch(window, "popstate");
    assert.equal(query.value, ""); assert.equal(tag.value, "certificates");
    position++; location.href = states[position]; dispatch(window, "popstate");
    assert.equal(query.value, "openssl pfx");
    query.value = '<img src=x onerror=alert(1)> &'; dispatch(query, "input"); scheduled();
    assert.deepEqual(visible(), []);
    assert.equal(new URL(location.href).searchParams.get("q"), query.value);
    assert.equal(document.querySelectorAll("img").length, 0);
    dispatch(form, "reset"); assert.deepEqual(visible(), ["/a/", "/b/"]);
    assert.equal(new URL(location.href).search, "?keep=yes");
    location.href = "https://example.com/snippets/?tag=unknown&q=OPENSSL"; dispatch(window, "popstate");
    assert.equal(tag.value, ""); assert.deepEqual(visible(), ["/b/"]);
    const fallback = parseHTML('<div data-content-search="snippet" data-index="/snippet-search.json"><form hidden><input id="query"><select id="tag"></select></form><p role="status" hidden></p><section data-content-url="/a/"></section></div>');
    vm.runInNewContext(script, { document: fallback.document, fetch: async () => { throw new Error("offline"); } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fallback.document.querySelector("form").hidden, true);
    assert.equal(fallback.document.querySelector("section").hidden, false);
    assert.match(fallback.document.querySelector("p").textContent, /unavailable/);
});
