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
    eleventyConfig.addPassthroughCopy("src/assets/js");
    eleventyConfig.addPassthroughCopy("src/assets/favicon");
    eleventyConfig.addPassthroughCopy("src/assets/fonts/FiraCode-Regular.ttf");
    eleventyConfig.addPlugin(syntaxHighlight, { alwaysWrapLineHighlights: true });
    eleventyConfig.addFilter("categories", items => [...new Set(items.map(item => item.data.category))].sort());
    eleventyConfig.addFilter("searchIndex", items => items.map(item => ({
        url: item.url, category: item.data.category,
        text: [item.data.title, item.data.description, item.data.category, item.data.platform,
            ...(item.data.tags || []), item.templateContent.replace(/<[^>]*>/g, " ")].join(" ").toLowerCase(),
    })));
    eleventyConfig.addFilter("absoluteUrl", (path, base) => new URL(path, base).href);
    eleventyConfig.addFilter("publishedISO", value => asDate(value).toISOString());
    eleventyConfig.addFilter("displayDate", value => asDate(value).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    }));
    eleventyConfig.addFilter("isUpdated", (modified, published) => Boolean(modified) && asDate(modified) > asDate(published));
    eleventyConfig.addFilter("jsonSafe", value => JSON.stringify(value).replace(/</g, "\\u003c"));
    eleventyConfig.addFilter("articleSchema", (data, url, site) => ({
        "@context": "https://schema.org", "@type": "TechArticle",
        headline: data.title, description: data.description,
        url: new URL(url, site.url).href, datePublished: asDate(data.page.date).toISOString(),
        ...(data.last_modified ? { dateModified: asDate(data.last_modified).toISOString() } : {}),
    }));
    eleventyConfig.addFilter("rssDate", value => asDate(value).toUTCString());
    eleventyConfig.addFilter("newestFirst", items => [...items].sort((a, b) =>
        asDate(b.date) - asDate(a.date)));
    return {
        markdownTemplateEngine: "liquid",
        dir: { input: "src", data: "_data", includes: "_includes", layouts: "_layouts" },
    };
};
