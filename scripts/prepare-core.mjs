import { prepareSite } from "../index.mjs";

// Usage:
//   node ./node_modules/@kaiano/eleventy-core/scripts/prepare-core.mjs
// Or (recommended) in your site package.json:
//   "prepare:core": "node ./node_modules/@kaiano/eleventy-core/scripts/prepare-core.mjs"

await prepareSite();
