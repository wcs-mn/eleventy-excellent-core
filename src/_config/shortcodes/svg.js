import path from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";
import { readFileSync, existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveSvgPath = (svgName) => {
  const fileName = `${svgName}.svg`;

  // Site first
  const sitePath = path.resolve(process.cwd(), "src", "assets", "svg", fileName);
  if (existsSync(sitePath)) return sitePath;

  // Core fallback: this file is <core>/src/_config/shortcodes/svg.js
  const corePath = path.resolve(__dirname, "..", "..", "assets", "svg", fileName);
  if (existsSync(corePath)) return corePath;

  return null;
};

export const svgShortcode = async (svgName, ariaName = "", className = "", styleName = "") => {
  const resolvedPath = resolveSvgPath(svgName);

  // Soft-fail so builds don’t die if a site hasn’t added the SVG yet
  if (!resolvedPath) return "";

  const svgData = readFileSync(resolvedPath, "utf8");
  const { data } = optimize(svgData);

  return data.replace(
    /<svg(.*?)>/,
    `<svg$1 ${ariaName ? `aria-label="${ariaName}"` : 'aria-hidden="true"'} ${className ? `class="${className}"` : ""} ${styleName ? `style="${styleName}"` : ""} >`
  );
};