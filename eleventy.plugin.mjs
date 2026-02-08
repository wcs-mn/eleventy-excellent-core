import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import yaml from 'js-yaml';

import { getAllPosts, showInSitemap, tagList } from './src/_config/collections.js';
import events from './src/_config/events.js';
import filters from './src/_config/filters.js';
import plugins from './src/_config/plugins.js';
import shortcodes from './src/_config/shortcodes.js';
import fg from 'fast-glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function coreSrcPath() {
  // => <project>/node_modules/@wcs-mn/eleventy-excellent-core/src
  return path.resolve(__dirname, 'src');
}

// Back-compat / public API: sites expect `corePaths`.
// Keep `coreSrcPath()` as the canonical implementation.
export function corePaths() {
  return coreSrcPath();
}

/**
 * Returns template search paths for engines that support multiple include/layout roots.
 * Order matters: site paths first so they override core.
 */
export function getTemplateSearchPaths({ siteSrc, coreSrc } = {}) {
  const resolvedSiteSrc = siteSrc ? path.resolve(siteSrc) : path.resolve(process.cwd(), 'src');
  const resolvedCoreSrc = coreSrc ? path.resolve(coreSrc) : coreSrcPath();

  return [
    path.join(resolvedSiteSrc, '_includes'),
    path.join(resolvedSiteSrc, '_layouts'),
    path.join(resolvedCoreSrc, '_includes'),
    path.join(resolvedCoreSrc, '_layouts')
  ];
}

const stripKnownExt = (p) => {
  // Handle .11ty.js first
  if (p.endsWith('.11ty.js')) return p.slice(0, -'.11ty.js'.length);
  return p.replace(/\.(njk|liquid|html|md)$/i, '');
};

const fileExists = async (p) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

const hasSiteLayoutOverride = async (siteLayoutsDir, relNoExt) => {
  const candidates = [
    `${relNoExt}.njk`,
    `${relNoExt}.liquid`,
    `${relNoExt}.html`,
    `${relNoExt}.md`,
    `${relNoExt}.11ty.js`
  ];
  for (const rel of candidates) {
    if (await fileExists(path.join(siteLayoutsDir, rel))) return true;
  }
  return false;
};

/**
 * Eleventy Excellent Core (theme-like) plugin.
 *
 * Goals:
 * - Provide shared includes/layouts/assets/config from a single package.
 * - Allow each site to override by placing files in its own src/_includes + src/_layouts.
 * - Avoid any "merge to _merged" pre-step.
 */
export default async function eleventyExcellentCore(eleventyConfig, opts = {}) {
  // Make env vars available for sites that rely on process.env.*
  if (opts.loadDotenv !== false) {
    dotenv.config();
  }

  const options = {
    // Site repo directories (relative to process.cwd())
    siteInputDir: 'src',
    outputDir: 'dist',

    // Whether to run the EE build pipeline (CSS/JS bundling) from core assets.
    // You can turn this off and manage CSS/JS in your site instead.
    enableBuildPipeline: true,

    // Whether core should configure template search paths for Nunjucks/Liquid.
    // When enabled, site templates override core templates.
    configureTemplateSearchPaths: true,

    // Automatically register layout aliases for layouts shipped by the core package.
    // This lets consuming sites use `layout: <name>` without extra Eleventy config.
    autoRegisterLayoutAliases: true,

    // Whether to run svgToJpeg after build when serving.
    enableSvgToJpegOnServe: true,

    // Whether to load .env inside the core plugin (can be disabled by sites).
    loadDotenv: true,

    // Additional WebC component globs from the site repo.
    // Example: ['./src/_includes/webc/**/*.webc']
    siteWebcComponents: [],

    ...opts
  };

  const coreSrc = coreSrcPath();
  const siteSrc = path.resolve(process.cwd(), options.siteInputDir);
  const outDir = path.resolve(process.cwd(), options.outputDir);

  // Expose useful paths to templates + site config
  eleventyConfig.addGlobalData('eeCore', {
    coreSrc,
    coreIncludes: path.join(coreSrc, '_includes'),
    coreLayouts: path.join(coreSrc, '_layouts'),
    coreData: path.join(coreSrc, '_data'),
    coreAssets: path.join(coreSrc, 'assets'),
    siteSrc,
    outDir
  });

  // --------------------- Template lookup paths (theme-like overrides)
  // Configure engines that support multiple include/layout roots so that:
  // 1) site templates win
  // 2) core templates act as fallback
  if (options.configureTemplateSearchPaths) {
    const includePaths = getTemplateSearchPaths({ siteSrc, coreSrc });

    // Nunjucks
    try {
      eleventyConfig.setNunjucksEnvironmentOptions({ includePaths });
    } catch {
      // ignore
    }

    // Liquid
    try {
      eleventyConfig.setLiquidOptions({ partials: includePaths });
    } catch {
      // ignore
    }
  }

  // --------------------- Layout aliases (theme-like layouts)
  // Eleventy layout resolution does not use Nunjucks/Liquid includePaths.
  // Register aliases so `layout: <name>` works with core-provided layouts.
  // Site overrides (src/_layouts/...) take precedence: if a site defines a matching layout,
  // we do not alias that key to core.
  if (options.autoRegisterLayoutAliases) {
    const siteLayoutsDir = path.join(siteSrc, '_layouts');
    const coreLayoutsDir = path.join(coreSrc, '_layouts');

    const coreLayoutFiles = await fg(['**/*.{njk,liquid,html,md}', '**/*.11ty.js'], {
      cwd: coreLayoutsDir,
      onlyFiles: true,
      dot: false
    });

    for (const rel of coreLayoutFiles) {
      const relNoExt = stripKnownExt(rel);

      // Skip aliasing if the site provides an override for the same relative layout name.
      if (await hasSiteLayoutOverride(siteLayoutsDir, relNoExt)) {
        continue;
      }

      // Eleventy layout keys use forward slashes.
      const layoutKey = relNoExt.split(path.sep).join('/');

      // Use a project-relative path so Eleventy can resolve it consistently across environments.
      const fullPath = path.join(coreLayoutsDir, rel);
      const projectRelativePath = path.relative(process.cwd(), fullPath).split(path.sep).join('/');

      try {
        eleventyConfig.addLayoutAlias(layoutKey, projectRelativePath);
      } catch {
        // ignore
      }
    }
  }

  // --------------------- Events: before build
  if (options.enableBuildPipeline) {
    eleventyConfig.on('eleventy.before', async () => {
      // Build core CSS/JS into the *site* includes/output.
      await events.buildAllCss({ coreSrc, siteSrc, outDir });
      await events.buildAllJs({ coreSrc, siteSrc, outDir });
    });
  }

  // --------------------- Watch targets
  // Use forward-slash globs for reliable cross-platform watching.
  const toPosixPath = p => p.replaceAll('\\\\', '/');
  const coreSrcPosix = toPosixPath(coreSrc);

  eleventyConfig.addWatchTarget('./src/assets/');
  eleventyConfig.addWatchTarget('./src/_includes/');
  eleventyConfig.addWatchTarget(`${coreSrcPosix}/assets/`);
  eleventyConfig.addWatchTarget(`${coreSrcPosix}/_includes/`);

  // --------------------- Collections
  eleventyConfig.addCollection('allPosts', getAllPosts);
  eleventyConfig.addCollection('showInSitemap', showInSitemap);
  eleventyConfig.addCollection('tagList', tagList);

  // --------------------- Plugins
  eleventyConfig.addPlugin(plugins.htmlConfig);
  eleventyConfig.addPlugin(plugins.drafts);
  eleventyConfig.addPlugin(plugins.EleventyRenderPlugin);
  eleventyConfig.addPlugin(plugins.rss);
  eleventyConfig.addPlugin(plugins.syntaxHighlight);

  // WebC: include core components + any site components
  const coreWebc = [path.join(coreSrc, '_includes/webc/**/*.webc')];
  const webcComponents = [...coreWebc, ...(options.siteWebcComponents || [])];
  eleventyConfig.addPlugin(plugins.webc, {
    components: webcComponents,
    useTransform: true
  });

  eleventyConfig.addPlugin(plugins.eleventyImageTransformPlugin, {
    formats: ['webp', 'jpeg'],
    widths: ['auto'],
    htmlOptions: {
      imgAttributes: {
        loading: 'lazy',
        decoding: 'async'
      },
      pictureAttributes: {}
    }
  });

  // --------------------- Bundle
  eleventyConfig.addBundle('css', { hoist: true });

  // --------------------- Library and Data
  eleventyConfig.setLibrary('md', plugins.markdownLib);
  eleventyConfig.addDataExtension('yaml', contents => yaml.load(contents));

  // --------------------- Filters
  eleventyConfig.addFilter('toIsoString', filters.toISOString);
  eleventyConfig.addFilter('formatDate', filters.formatDate);
  eleventyConfig.addFilter('markdownFormat', filters.markdownFormat);
  eleventyConfig.addFilter('splitlines', filters.splitlines);
  eleventyConfig.addFilter('striptags', filters.striptags);
  eleventyConfig.addFilter('shuffle', filters.shuffleArray);
  eleventyConfig.addFilter('alphabetic', filters.sortAlphabetically);
  eleventyConfig.addFilter('slugify', filters.slugifyString);

  // --------------------- Shortcodes
  eleventyConfig.addShortcode('svg', shortcodes.svgShortcode);
  eleventyConfig.addShortcode('image', shortcodes.imageShortcode);
  eleventyConfig.addShortcode('imageKeys', shortcodes.imageKeysShortcode);
  eleventyConfig.addShortcode('year', () => `${new Date().getFullYear()}`);

  // --------------------- Events: after build
  const isServe = process.argv.includes('--serve') || process.env.ELEVENTY_RUN_MODE === 'serve';
  if (isServe && options.enableSvgToJpegOnServe) {
    eleventyConfig.on('eleventy.after', events.svgToJpeg);
  }

  // --------------------- Passthrough Copy
  // Core shared assets
  ['fonts/', 'images/template', 'og-images'].forEach(p =>
    eleventyConfig.addPassthroughCopy(path.join(coreSrc, 'assets', p))
  );

  eleventyConfig.addPassthroughCopy({
    // favicon images in core -> site root
    [path.join(coreSrc, 'assets/images/favicon/*')]: '/',

    // lite-youtube embed assets from node_modules
    'node_modules/lite-youtube-embed/src/lite-yt-embed.{css,js}': 'assets/components/'
  });

  // Sites can add their own passthrough rules in their eleventy config.

  // ---------------------- Ignore test files
  // If a consuming site includes a pa11y template under its own input dir, ignore it outside tests.
  if (process.env.ELEVENTY_ENV !== 'test') {
    eleventyConfig.ignores.add(`${options.siteInputDir}/common/pa11y.njk`);
  }

  return {
    // Provide this so sites can read it if needed
    eeCore: { coreSrc, siteSrc, outDir }
  };
}
