const { publicTags, tagCatalog } = require("./lib/tags.cjs");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

function asDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid content date: ${value}`);
    return date;
}

module.exports = function (eleventyConfig) {
    eleventyConfig.addPassthroughCopy({ ".cache/tailwind.css": "assets/css/tailwind.css" });
    eleventyConfig.addWatchTarget(".cache/tailwind.css");
    eleventyConfig.addPassthroughCopy("src/assets/css/prism-theme.css");
    eleventyConfig.addPassthroughCopy("src/assets/images");
    eleventyConfig.addPassthroughCopy("src/assets/js/site.js");
    eleventyConfig.addPassthroughCopy("src/assets/js/snippets.js");
    if (process.env.BLOG_PRODUCTION === "true") {
        eleventyConfig.addPassthroughCopy("src/assets/js/analytics.js");
    }
    eleventyConfig.addPassthroughCopy("src/assets/favicon");
    eleventyConfig.addPassthroughCopy("src/assets/fonts/FiraCode-Regular.ttf");
    eleventyConfig.addPlugin(syntaxHighlight, { alwaysWrapLineHighlights: true });
    eleventyConfig.amendLibrary("md", require("./lib/code-blocks.cjs"));
    eleventyConfig.addCollection("publicTags", api => tagCatalog(api.getAll().filter(item =>
        (item.data.tags || []).some(tag => ["post", "snippet"].includes(tag)))));
    eleventyConfig.addFilter("contentTags", publicTags);
    eleventyConfig.addFilter("snippetTags", items => tagCatalog(items));
    eleventyConfig.addFilter("searchIndex", items => items.map(item => ({
        url: item.url, tags: publicTags(item.data.tags).map(tag => tag.slug),
        text: [item.data.title, item.data.description, item.data.platform,
            ...publicTags(item.data.tags).map(tag => tag.label),
            item.templateContent.replace(/<[^>]*>/g, " ")].join(" ").toLowerCase(),
    })));
    eleventyConfig.addFilter("absoluteUrl", (path, base) => new URL(path, base).href);
    eleventyConfig.addFilter("publishedISO", value => asDate(value).toISOString());
    eleventyConfig.addFilter("displayDate", value => asDate(value).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }));
    eleventyConfig.addFilter("isUpdated", (modified, published) => Boolean(modified) && asDate(modified) > asDate(published));
    eleventyConfig.addFilter("jsonSafe", value => JSON.stringify(value).replace(/</g, "\\u003c"));
    eleventyConfig.addFilter("articleSchema", (title, description, published, modified, url, site) => ({
        "@context": "https://schema.org", "@type": "TechArticle",
        headline: title, description,
        url: new URL(url, site.url).href, datePublished: asDate(published).toISOString(),
        ...(modified && asDate(modified) > asDate(published) ? { dateModified: asDate(modified).toISOString() } : {}),
    }));
    eleventyConfig.addFilter("rssDate", value => asDate(value).toUTCString());
    eleventyConfig.addFilter("head", (items, count) => items.slice(0, count));
    eleventyConfig.addFilter("newestFirst", items => [...items].sort((a, b) =>
        asDate(b.date) - asDate(a.date)));
    return {
        markdownTemplateEngine: "liquid",
        dir: { input: "src", data: "_data", includes: "_includes", layouts: "_layouts" },
    };
};
