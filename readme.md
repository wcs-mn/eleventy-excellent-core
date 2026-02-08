# @wcs-mn/eleventy-excellent-core

This package turns **Eleventy Excellent (Plus)** into a reusable, theme-like **core** layer for multiple Eleventy sites.

## Goals

- Keep **shared** layouts/includes/assets/config in one place.
- Allow each site to keep **site-only content and widgets** separate.
- Let sites **override** core includes/layouts by simply providing a file with the same relative path.
- Avoid a prebuild “merge” step (no `_merged` / `_core`).

## Install

From GitHub:

```bash
npm i github:wcs-mn/eleventy-excellent-core
```

(Recommended for stability once you’re ready: pin to a tag, e.g. `#v0.1.0`.)

## Use in a site

In your site’s `eleventy.config.mjs`:

```js
import path from 'node:path';
import eleventyExcellentCore, { corePaths, getTemplateSearchPaths } from '@wcs-mn/eleventy-excellent-core';

export default function(eleventyConfig) {
  // Mount the core plugin (filters/shortcodes/plugins, passthrough copy, build pipeline hooks)
  eleventyConfig.addPlugin(eleventyExcellentCore, {
    // Defaults shown; override if your site uses different dirs
    siteInputDir: 'src',
    outDir: 'dist',

    // If you want core to run the css/js build pipeline on `eleventy.before`:
    enableBuildPipeline: true,

    // Add site WebC components in addition to core WebC components
    siteWebcComponents: ['./src/_includes/webc/**/*.webc']
  });

  // Theme-like lookup: site first, then core
  const searchPaths = getTemplateSearchPaths({
    siteSrc: path.resolve('src'),
    coreSrc: corePaths()
  });

  eleventyConfig.setNunjucksEnvironmentOptions({
    includePaths: searchPaths
  });

  eleventyConfig.setLiquidOptions({
    partials: searchPaths
  });

  // Site-only passthrough assets (widgets, images, etc.)
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });

  return {
    dir: {
      input: 'src',
      output: 'dist',
      includes: '_includes',
      layouts: '_layouts'
    },
    markdownTemplateEngine: 'njk'
  };
}
```

## Override behavior

If core provides:

- `src/_includes/partials/nav.njk`

and your site adds:

- `src/_includes/partials/nav.njk`

Then your **site version wins**, without copying anything out of `node_modules`.

## Site-specific widgets

Keep widgets in the site repo only, e.g.:

```
src/assets/scripts/widgets/kaianolevine/...
```

In core layouts, inject widgets based on site data (recommended):

`src/_data/site.js` in the site repo:

```js
export default {
  widgetScripts: [
    '/assets/scripts/widgets/kaianolevine/spotify-playlists.js'
  ]
};
```

Then in a core layout (Nunjucks):

```njk
{% if site.widgetScripts %}
  {% for src in site.widgetScripts %}
    <script type="module" src="{{ src }}"></script>
  {% endfor %}
{% endif %}
```

## Notes

- This core package includes the original Eleventy Excellent build pipeline (CSS/JS bundling) but rewritten to support running from `node_modules`.
- Your site can disable the build pipeline (`enableBuildPipeline: false`) and manage assets any other way.
