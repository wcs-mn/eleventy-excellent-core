import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import esbuild from 'esbuild';

export const buildJs = async (inputPath, outputPath) => {
  const result = await esbuild.build({
    target: 'es2020',
    entryPoints: [inputPath],
    bundle: true,
    minify: true,
    write: false
  });

  const output = result.outputFiles[0].text;

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, output);

  return output;
};

/**
 * Build JS bundles from the *core* package sources, but emit them into the *site* build locations.
 *
 * @param {Object} args
 * @param {string} args.coreSrc Absolute path to core src dir (node_modules/.../src)
 * @param {string} args.siteSrc Absolute path to site src dir
 * @param {string} args.outDir Site output dir (absolute or relative to cwd)
 */
export const buildAllJs = async ({ coreSrc, siteSrc, outDir }) => {
  const tasks = [];

  const coreAssetsScripts = path.join(coreSrc, 'assets', 'scripts');

  // Inline bundle JS -> site includes (for embedding)
  const inlineBundleFiles = await fg([path.join(coreAssetsScripts, 'bundle', '**/*.js')]);
  for (const inputPath of inlineBundleFiles) {
    const baseName = path.basename(inputPath);
    const includeOutPath = path.join(siteSrc, '_includes', 'scripts', baseName);
    const assetOutPath = path.join(outDir, 'assets', 'core', 'scripts', baseName);
    tasks.push(buildJs(inputPath, includeOutPath));
    tasks.push(buildJs(inputPath, assetOutPath));
  }

  // Component JS -> site output (static asset)
  const componentFiles = await fg([path.join(coreAssetsScripts, 'components', '**/*.js')]);
  for (const inputPath of componentFiles) {
    const baseName = path.basename(inputPath);
    const outputPath = path.join(outDir, 'assets', 'scripts', 'components', baseName);
    tasks.push(buildJs(inputPath, outputPath));
  }

  await Promise.all(tasks);
};
