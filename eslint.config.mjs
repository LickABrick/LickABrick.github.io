import js from "@eslint/js";
import globals from "globals";

export default [
    { ignores: ["_site/**", "node_modules/**", ".cache/**", "coverage/**"] },
    js.configs.recommended,
    {
        files: ["**/*.{js,cjs,mjs}"],
        languageOptions: { globals: globals.node },
    },
    {
        files: ["src/assets/js/**/*.js"],
        languageOptions: { sourceType: "module", globals: globals.browser },
    },
    {
        files: ["**/*.{js,cjs}"],
        ignores: ["src/assets/js/**"],
        languageOptions: { sourceType: "commonjs" },
    },
];
