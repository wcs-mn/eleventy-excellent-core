import path from "node:path";
import fs from "node:fs/promises";
import fssync from "node:fs";

/**
 * Returns the absolute path to the packaged core `src` directory.
 */
export function coreSrcDir() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "src");
}

/**
 * Eleventy config helper (optional).
 * Your site can call this, then add any site-specific config on top.
 */
export async function setup(eleventyConfig, options = {}) {
  // This core package assumes your site will run the prepare step that
  // merges includes/layouts/assets into your local `src/_merged`.
  // Keeping setup minimal avoids fighting each site's overrides.

  // Convenience: allow sites to reuse the same watch targets.
  const watchTargets = options.watchTargets ?? [
    "./src/assets/**/*.{css,js,svg,png,jpeg,webp}",
    "./src/_merged/_includes/**/*.{webc,njk,liquid,md}"
  ];
  for (const t of watchTargets) eleventyConfig.addWatchTarget(t);

  return eleventyConfig;
}

/**
 * Recursively copy a directory.
 */
async function copyDir(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else if (entry.isFile()) await fs.copyFile(s, d);
  }
}

/**
 * Prepare a site by:
 *  - copying core src -> site src/_core
 *  - generating merged includes/layouts -> site src/_merged
 *
 * Overlay rule: site wins on conflicts.
 */
export async function prepareSite({
  siteRoot = process.cwd(),
  siteSrc = "src",
  siteLayerDir = "site",
  outCoreDir = "_core",
  outMergedDir = "_merged",
  clean = true
} = {}) {
  const siteSrcAbs = path.resolve(siteRoot, siteSrc);
  const coreSrcAbs = coreSrcDir();

  const outCoreAbs = path.join(siteSrcAbs, outCoreDir);
  const outMergedAbs = path.join(siteSrcAbs, outMergedDir);

  const siteLayerAbs = path.join(siteSrcAbs, siteLayerDir);

  const coreIncludes = path.join(outCoreAbs, "_includes");
  const coreLayouts = path.join(outCoreAbs, "_layouts");

  const siteIncludes = path.join(siteLayerAbs, "_includes");
  const siteLayouts = path.join(siteLayerAbs, "_layouts");

  const mergedIncludes = path.join(outMergedAbs, "_includes");
  const mergedLayouts = path.join(outMergedAbs, "_layouts");

  // Clean
  if (clean) {
    for (const p of [outCoreAbs, outMergedAbs]) {
      if (fssync.existsSync(p)) await fs.rm(p, { recursive: true, force: true });
    }
  }

  // Copy core src -> site/_core
  await copyDir(coreSrcAbs, outCoreAbs);

  // Build merged dirs: core first, then site overlay.
  await copyDir(coreIncludes, mergedIncludes);
  await copyDir(coreLayouts, mergedLayouts);

  if (fssync.existsSync(siteIncludes)) await copyDir(siteIncludes, mergedIncludes);
  if (fssync.existsSync(siteLayouts)) await copyDir(siteLayouts, mergedLayouts);

  return { outCoreAbs, outMergedAbs };
}
