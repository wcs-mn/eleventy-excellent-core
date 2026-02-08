import { prepareSite } from "../index.mjs";

// Usage:
//   node ./node_modules/@wcs-mn/eleventy-excellent-core/scripts/prepare-core.mjs
// Or (recommended) in your site package.json:
//   "prepare:core": "node ./node_modules/@wcs-mn/eleventy-excellent-core/scripts/prepare-core.mjs"

await prepareSite();
