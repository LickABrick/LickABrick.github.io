const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
require('dotenv').config();

module.exports = function (eleventyConfig) {
    eleventyConfig.addGlobalData('env', process.env.NODE_ENV);
    
    eleventyConfig.addPassthroughCopy("src/assets/css/tailwind.css");
    eleventyConfig.addPassthroughCopy("src/assets/css/prism-theme.css");
    eleventyConfig.addPassthroughCopy("src/assets/images");
    eleventyConfig.addPassthroughCopy("src/assets/favicon");
    eleventyConfig.addPassthroughCopy("src/assets/fonts/FiraCode-Regular.ttf");
    eleventyConfig.addPlugin(syntaxHighlight, {
        alwaysWrapLineHighlights: true,
    });
    return {
        dir: {
            input: "src",
            data: "_data",
            includes: "_includes",
            layouts: "_layouts",
        },
    };
};
