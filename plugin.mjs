/**
 * @wcs-mn/ee-core
 * Packaged Eleventy Excellent core: templates + assets + plugin wiring.
 *
 * This plugin is intentionally conservative:
 * - No bundle shortcodes (no `{% css %}` / `{% js %}` / `{% getBundle %}`).
 * - Core assets are copied via passthrough from the package into the site output.
 *
 * Sites should:
 * 1) addPlugin(eeCore)
 * 2) set a Nunjucks loader that searches site includes first, then this package's src/_includes.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import yaml from "js-yaml";

import { getAllPosts, showInSitemap, tagList } from "./src/_config/collections.js";
import events from "./src/_config/events.js"; // kept for svgToJpeg only
import filters from "./src/_config/filters.js";
import plugins from "./src/_config/plugins.js";
import shortcodes from "./src/_config/shortcodes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreSrc = path.join(__dirname, "src");

function corePath(...parts) {
  return path.join(coreSrc, ...parts);
}

export default function eeCore(eleventyConfig, options = {}) {
  dotenv.config();

  // --------------------- Watch targets (helpful locally)
  eleventyConfig.addWatchTarget(corePath("assets"));
  eleventyConfig.addWatchTarget(corePath("_includes"));

  // --------------------- Layout aliases (layout names come from templates)
  eleventyConfig.addLayoutAlias("base", "base.njk");
  eleventyConfig.addLayoutAlias("page", "page.njk");
  eleventyConfig.addLayoutAlias("post", "post.njk");
  eleventyConfig.addLayoutAlias("tags", "tags.njk");

  // --------------------- Collections
  eleventyConfig.addCollection("allPosts", getAllPosts);
  eleventyConfig.addCollection("showInSitemap", showInSitemap);
  eleventyConfig.addCollection("tagList", tagList);

  // --------------------- Plugins
  eleventyConfig.addPlugin(plugins.htmlConfig);
  eleventyConfig.addPlugin(plugins.drafts);
  eleventyConfig.addPlugin(plugins.EleventyRenderPlugin);
  eleventyConfig.addPlugin(plugins.rss);
  eleventyConfig.addPlugin(plugins.syntaxHighlight);

  // WebC components live in core package
  eleventyConfig.addPlugin(plugins.webc, {
    components: [corePath("_includes", "webc", "**", "*.webc")],
    useTransform: true
  });

  // Image transform plugin
  eleventyConfig.addPlugin(plugins.eleventyImageTransformPlugin, {
    formats: ["webp", "jpeg"],
    widths: ["auto"],
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async" },
      pictureAttributes: {}
    }
  });

  // --------------------- Library and Data
  eleventyConfig.setLibrary("md", plugins.markdownLib);
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

  // --------------------- Filters
  eleventyConfig.addFilter("toIsoString", filters.toISOString);
  eleventyConfig.addFilter("formatDate", filters.formatDate);
  eleventyConfig.addFilter("markdownFormat", filters.markdownFormat);
  eleventyConfig.addFilter("splitlines", filters.splitlines);
  eleventyConfig.addFilter("striptags", filters.striptags);
  eleventyConfig.addFilter("shuffle", filters.shuffleArray);
  eleventyConfig.addFilter("alphabetic", filters.sortAlphabetically);
  eleventyConfig.addFilter("slugify", filters.slugifyString);

  // --------------------- Shortcodes
  eleventyConfig.addShortcode("svg", shortcodes.svgShortcode);
  eleventyConfig.addShortcode("image", shortcodes.imageShortcode);
  eleventyConfig.addShortcode("imageKeys", shortcodes.imageKeysShortcode);
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // --------------------- Events: after build (optional; only in serve)
  if (process.env.ELEVENTY_RUN_MODE === "serve") {
    eleventyConfig.on("eleventy.after", events.svgToJpeg);
  }

  // --------------------- Passthrough Copy
  // Keep Eleventy Excellent's public paths so templates remain compatible.
  eleventyConfig.addPassthroughCopy({ [corePath("assets", "fonts")]: "assets/fonts" });
  eleventyConfig.addPassthroughCopy({ [corePath("assets", "images", "template")]: "assets/images/template" });
  eleventyConfig.addPassthroughCopy({ [corePath("assets", "og-images")]: "assets/og-images" });
  eleventyConfig.addPassthroughCopy({ [corePath("assets", "svg")]: "assets/svg" });

  // JS sources (served as-is; sites can bundle if they want)
  eleventyConfig.addPassthroughCopy({ [corePath("assets", "scripts")]: "assets/scripts" });

  // Favicons to site root
  eleventyConfig.addPassthroughCopy({ [corePath("assets", "images", "favicon")]: "/" });

  // lite-youtube embed assets (if hoisted, this path resolves at site root; if nested, Eleventy will still read it)
  try {
    const liteCss = path.join(path.dirname(fileURLToPath(import.meta.resolve("lite-youtube-embed/package.json"))), "src", "lite-yt-embed.css");
    const liteJs = path.join(path.dirname(fileURLToPath(import.meta.resolve("lite-youtube-embed/package.json"))), "src", "lite-yt-embed.js");
    eleventyConfig.addPassthroughCopy({ [liteCss]: "assets/components/lite-yt-embed.css" });
    eleventyConfig.addPassthroughCopy({ [liteJs]: "assets/components/lite-yt-embed.js" });
  } catch (e) {
    // Ignore if dependency not installed/hoisted yet; consumer can add passthrough if needed.
  }

  // ---------------------- Ignore test files
  if (process.env.ELEVENTY_ENV !== "test") {
    eleventyConfig.ignores.add("src/common/pa11y.njk");
  }

  // Nothing returned here; the consuming site's eleventy config controls dirs/output.
}
