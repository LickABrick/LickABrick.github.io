const internal = new Set(["post", "snippet", "page"]);
const labels = { powershell: "PowerShell", openssl: "OpenSSL", pfx: "PFX", "power-automate": "Power Automate" };

// Case and whitespace are equivalent. Punctuation is slugged, not silently
// merged: different normalized names with the same slug fail the build.
function publicTags(values) {
    const result = new Map();
    for (const value of Array.isArray(values) ? values : values ? [values] : []) {
        if (typeof value !== "string") throw new Error("Content tags must be strings");
        const name = value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
        if (!name || internal.has(name)) continue;
        const slug = name.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!slug) throw new Error(`Tag needs a URL-safe name: ${value}`);
        const previous = result.get(slug);
        if (previous && previous.name !== name) throw new Error(`Tag slug collision: ${previous.name} / ${name}`);
        result.set(slug, { name, slug, label: Object.hasOwn(labels, name) ? labels[name] : name, url: `/tags/${slug}/` });
    }
    return [...result.values()];
}

function tagCatalog(items) {
    const catalog = new Map();
    for (const item of items) {
        for (const tag of publicTags(item.data.tags)) {
            const previous = catalog.get(tag.slug);
            if (previous && previous.name !== tag.name) throw new Error(`Tag slug collision: ${previous.name} / ${tag.name}`);
            if (!previous) catalog.set(tag.slug, { ...tag, posts: [], snippets: [] });
            const group = (item.data.tags || []).includes("snippet") ? "snippets" : "posts";
            const entries = catalog.get(tag.slug)[group];
            if (!entries.includes(item)) entries.push(item);
        }
    }
    for (const tag of catalog.values()) {
        for (const group of ["posts", "snippets"]) tag[group].sort((a, b) => b.date - a.date);
    }
    return [...catalog.values()].sort((a, b) => a.slug.localeCompare(b.slug, "en"));
}
module.exports = { publicTags, tagCatalog };
