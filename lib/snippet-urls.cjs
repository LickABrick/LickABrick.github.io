function snippetPermalink({ slug, page }) {
    const name = slug || page.fileSlug;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
        throw new Error(`Snippet slug must use lowercase letters, numbers and hyphens: ${page.inputPath}`);
    }
    return `/snippets/${name}/`;
}

function validateSnippetUrls(items) {
    const seen = new Map();
    for (const item of items) {
        if (!item.url) continue;
        const previous = seen.get(item.url);
        if (previous && previous !== item.inputPath) {
            throw new Error(`Duplicate canonical Snippet URL ${item.url}: ${previous} and ${item.inputPath}`);
        }
        seen.set(item.url, item.inputPath);
    }
    return items;
}
module.exports = { snippetPermalink, validateSnippetUrls };
