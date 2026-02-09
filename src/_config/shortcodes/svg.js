/**
 * Generates an optimized SVG shortcode with optional attributes.
 *
 * Resolution rules:
 * 1) If consuming site has `./src/assets/svg/<name>.svg`, use it (site override).
 * 2) Otherwise fall back to the SVG shipped inside @wcs-mn/ee-core.
 */

import { optimize } from "svgo";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(__dirname, "..", ".."); // .../src

function resolveSvgPath(svgName) {
  const siteCandidate = path.resolve(process.cwd(), "src", "assets", "svg", `${svgName}.svg`);
  if (existsSync(siteCandidate)) return siteCandidate;

  const coreCandidate = path.resolve(coreRoot, "assets", "svg", `${svgName}.svg`);
  return coreCandidate;
}

export const svgShortcode = async (svgName, ariaName = "", className = "", styleName = "") => {
  const svgPath = resolveSvgPath(svgName);
  const svgData = readFileSync(svgPath, "utf8");

  const { data } = await optimize(svgData);

  return data.replace(
    /<svg(.*?)>/,
    `<svg$1 ${ariaName ? `aria-label="${ariaName}"` : "aria-hidden=\"true\""} ${className ? `class=\"${className}\"` : ""} ${styleName ? `style=\"${styleName}\"` : ""} >`
  );
};
