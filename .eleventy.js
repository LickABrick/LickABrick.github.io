const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

// Existing publication dates are day-month-year, not JavaScript date strings.
function publishedDate(value) {
    const [day, month, year] = value.split("-");
    return new Date(`${year}-${month}-${day}T00:00:00Z`);
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
    eleventyConfig.addFilter("absoluteUrl", (path, base) => new URL(path, base).href);
    eleventyConfig.addFilter("publishedISO", value => publishedDate(value).toISOString());
    eleventyConfig.addFilter("rssDate", value => publishedDate(value).toUTCString());
    eleventyConfig.addFilter("newestFirst", items => [...items].sort((a, b) =>
        publishedDate(b.data.publish_date) - publishedDate(a.data.publish_date)));
    return {
        markdownTemplateEngine: "liquid",
        dir: { input: "src", data: "_data", includes: "_includes", layouts: "_layouts" },
    };
};
