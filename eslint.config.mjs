import js from "@eslint/js";
import next from "eslint-config-next";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,
  {
    settings: {
      react: { version: "19" },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "warn",
    },
  },
];