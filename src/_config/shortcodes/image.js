import Image from "@11ty/eleventy-img";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreRoot = path.resolve(__dirname, "..", ".."); // .../src

const stringifyAttributes = (attributeMap) =>
  Object.entries(attributeMap)
    .map(([attribute, value]) => (typeof value === "undefined" ? "" : `${attribute}="${value}"`))
    .join(" ");

const errorSrcRequired = (shortcodeName) => {
  throw new Error(`src parameter is required for {% ${shortcodeName} %} shortcode`);
};

function resolveImagePath(src) {
  // Normalize: accept "/assets/images/.." or "assets/images/.." or "./src/assets/images/.."
  const cleaned = src.startsWith("./src") ? src.slice("./src".length) : src;
  const normalized = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;

  const siteCandidate = path.resolve(process.cwd(), "src", normalized.replace(/^\//, ""));
  if (existsSync(siteCandidate)) return siteCandidate;

  const coreCandidate = path.resolve(coreRoot, normalized.replace(/^\//, ""));
  return coreCandidate;
}

// Handles image processing
const processImage = async (options) => {
  let {
    src,
    alt = "",
    caption = "",
    loading = "lazy",
    containerClass,
    imageClass,
    widths = [650, 960, 1400],
    sizes,
    formats = ["avif", "webp", "jpeg"]
  } = options;

  if (sizes == null) {
    sizes = loading === "lazy" ? "auto" : "100vw";
  }

  const inputPath = resolveImagePath(src);

  const metadata = await Image(inputPath, {
    widths: [...widths],
    formats: [...formats],
    urlPath: "/assets/images/",
    outputDir: "./dist/assets/images/",
    filenameFormat: (id, src, width, format) => {
      const extension = path.extname(src);
      const name = path.basename(src, extension);
      return `${name}-${width}w.${format}`;
    }
  });

  const lowsrc = metadata.jpeg[metadata.jpeg.length - 1];

  const imageSources = Object.values(metadata)
    .map((imageFormat) => {
      return `  <source type="${imageFormat[0].sourceType}" srcset="${imageFormat
        .map((entry) => entry.srcset)
        .join(", ")}" sizes="${sizes}">`;
    })
    .join("\n");

  const imageAttributes = stringifyAttributes({
    src: lowsrc.url,
    width: lowsrc.width,
    height: lowsrc.height,
    alt,
    loading,
    decoding: loading === "eager" ? "sync" : "async",
    ...(imageClass && { class: imageClass }),
    "eleventy:ignore": ""
  });

  const pictureElement = `<picture> ${imageSources}<img ${imageAttributes}></picture>`;

  return caption
    ? `<figure slot="image"${containerClass ? ` class=\"${containerClass}\"` : ""}>${pictureElement}<figcaption>${caption}</figcaption></figure>`
    : `<picture slot="image"${containerClass ? ` class=\"${containerClass}\"` : ""}>${imageSources}<img ${imageAttributes}></picture>`;
};

// Positional parameters (legacy)
export const imageShortcode = async (
  src,
  alt,
  caption,
  loading,
  containerClass,
  imageClass,
  widths,
  sizes,
  formats
) => {
  if (!src) errorSrcRequired("image");
  return processImage({ src, alt, caption, loading, containerClass, imageClass, widths, sizes, formats });
};

// Named parameters
export const imageKeysShortcode = async (options = {}) => {
  if (!options.src) errorSrcRequired("imageKeys");
  return processImage(options);
};
