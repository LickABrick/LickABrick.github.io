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
        files: ["**/*.{js,cjs}"],
        languageOptions: { sourceType: "commonjs" },
    },
];
