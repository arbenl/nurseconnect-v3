module.exports = {
  root: true,
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "turbo", "prettier"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import", "unused-imports"],
  rules: {
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "import/order": [
      "error",
      {
        "groups": ["builtin", "external", "internal", ["parent", "sibling"], "index"],
        "newlines-between": "always",
        "alphabetize": { "order": "asc", "caseInsensitive": true }
      }
    ],
    "no-console": ["warn", { allow: ["warn", "error"] }]
  },
  ignorePatterns: ["**/*.config.js", "**/*.config.ts", ".eslintrc.js", "dist", "node_modules"]
};
