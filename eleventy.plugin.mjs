import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import yaml from 'js-yaml';

import { getAllPosts, showInSitemap, tagList } from './src/_config/collections.js';
import events from './src/_config/events.js';
import filters from './src/_config/filters.js';
import plugins from './src/_config/plugins.js';
import shortcodes from './src/_config/shortcodes.js';

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
  dotenv.config();

  const options = {
    // Site repo directories (relative to process.cwd())
    siteInputDir: 'src',
    outputDir: 'dist',

    // Whether to run the EE build pipeline (CSS/JS bundling) from core assets.
    // You can turn this off and manage CSS/JS in your site instead.
    enableBuildPipeline: true,

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

  // --------------------- Events: before build
  if (options.enableBuildPipeline) {
    eleventyConfig.on('eleventy.before', async () => {
      // Build core CSS/JS into the *site* includes/output.
      await events.buildAllCss({ coreSrc, siteSrc, outDir });
      await events.buildAllJs({ coreSrc, siteSrc, outDir });
    });
  }

  // --------------------- Watch targets
  // Watch both site + core assets so changes trigger rebuild in dev.
  eleventyConfig.addWatchTarget(path.join(siteSrc, 'assets/**/*.{css,js,svg,png,jpeg,webp}'));
  eleventyConfig.addWatchTarget(path.join(coreSrc, 'assets/**/*.{css,js,svg,png,jpeg,webp}'));
  eleventyConfig.addWatchTarget(path.join(siteSrc, '_includes/**/*.{webc}'));
  eleventyConfig.addWatchTarget(path.join(coreSrc, '_includes/**/*.{webc}'));

  // --------------------- Layout aliases
  eleventyConfig.addLayoutAlias('base', 'base.njk');
  eleventyConfig.addLayoutAlias('page', 'page.njk');
  eleventyConfig.addLayoutAlias('post', 'post.njk');
  eleventyConfig.addLayoutAlias('tags', 'tags.njk');

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
  if (process.env.ELEVENTY_RUN_MODE === 'serve') {
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
  // Core ships pa11y template under src/common. Sites can opt-in.
  if (process.env.ELEVENTY_ENV !== 'test') {
    eleventyConfig.ignores.add('src/common/pa11y.njk');
  }

  return {
    // Provide this so sites can read it if needed
    eeCore: { coreSrc, siteSrc, outDir }
  };
}
