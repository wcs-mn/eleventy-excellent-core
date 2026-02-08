# @kaiano/eleventy-core

This package is a shared "core layer" based on Eleventy Excellent. It contains:
- `src/_includes`, `src/_layouts`
- `src/assets`, `src/common`
- `src/_config`, `src/_data`

It is designed to be used by multiple sites with **site-specific overrides**.

## How sites use this core

In a consuming site repo:

1) Install the package (from npm, GitHub, or a workspace):
   - npm: `npm i @kaiano/eleventy-core`
   - GitHub: `npm i github:kaianolevine/eleventy-core`
   - workspace: `npm i ../path/to/kaiano-eleventy-core`

2) Add a site layer folder:
   - `src/site/_includes` (optional overrides/additions)
   - `src/site/_layouts`  (optional overrides/additions)
   - `src/site/assets/...` (site-only widgets/scripts/styles)

3) Run the prepare step before Eleventy:
   - `node ./node_modules/@kaiano/eleventy-core/scripts/prepare-core.mjs`

This generates:
- `src/_core/*`   (a copy of the package’s `src`)
- `src/_merged/*` (Eleventy-facing includes/layouts, with site overrides winning)

Your Eleventy config should point includes/layouts at `src/_merged`.

## Why this design?

Eleventy does not support multiple includes/layout directories. The prepare step gives you:
- A deterministic merge order (core first, then site)
- A single includes/layouts directory for Eleventy
- No risk of site-only widgets creeping into core
