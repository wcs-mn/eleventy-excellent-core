import fs from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import postcssImport from 'postcss-import';
import postcssImportExtGlob from 'postcss-import-ext-glob';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import fg from 'fast-glob';

const buildCss = async (inputPath, outputPaths) => {
  const inputContent = await fs.readFile(inputPath, 'utf-8');

  const result = await postcss([
    postcssImportExtGlob,
    postcssImport,
    tailwindcss,
    autoprefixer,
    cssnano
  ]).process(inputContent, { from: inputPath });

  for (const outputPath of outputPaths) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, result.css);
  }

  return result.css;
};

/**
 * Build CSS from the core package into the consuming site's generated folders.
 *
 * @param {{coreSrc: string, siteSrc: string, outDir: string}} opts
 */
export const buildAllCss = async (opts) => {
  const { coreSrc, siteSrc, outDir } = opts;
  const tasks = [];

  const coreAssetsCss = path.join(coreSrc, 'assets', 'css');

  // Global CSS -> site includes (inline bundle)
  tasks.push(
    buildCss(
      path.join(coreAssetsCss, 'global', 'global.css'),
      [path.join(siteSrc, '_includes', 'css', 'global.css')]
    )
  );

  // Local CSS -> site includes (inline bundle)
  const localCssFiles = await fg([path.join(coreAssetsCss, 'local', '**/*.css')]);
  for (const inputPath of localCssFiles) {
    const baseName = path.basename(inputPath);
    tasks.push(buildCss(inputPath, [path.join(siteSrc, '_includes', 'css', baseName)]));
  }

  // Component CSS -> site output (static asset)
  const componentCssFiles = await fg([path.join(coreAssetsCss, 'components', '**/*.css')]);
  for (const inputPath of componentCssFiles) {
    const baseName = path.basename(inputPath);
    tasks.push(buildCss(inputPath, [path.join(outDir, 'assets', 'css', 'components', baseName)]));
  }

  await Promise.all(tasks);
};
