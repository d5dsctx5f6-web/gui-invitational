// Brief 30, Part F — regenerates the PWA/favicon/apple-touch-icon PNGs from the architect-
// delivered mark SVGs in public/icons/. Rerun this any time the mark changes rather than
// hand-exporting PNGs. Uses `sharp`, which ships as a transitive dep of `next` for its image
// optimizer — not a direct project dependency, so this script is the only place that reaches
// for it directly.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const iconsDir = path.join(process.cwd(), "public", "icons");
const markColor = readFileSync(path.join(iconsDir, "mark-color.svg"));

// modern SVG favicon — Chrome/Firefox/Safari 17+ all render this directly.
writeFileSync(path.join(iconsDir, "icon.svg"), markColor);

async function renderTransparent(size: number, outFile: string) {
  await sharp(markColor)
    .resize(size, size)
    .png()
    .toFile(path.join(iconsDir, outFile));
}

// Apple's home screen fills transparent PNG icons with black, so apple-touch-icon needs an
// opaque backing square. iOS also applies its own corner rounding, so the source stays a flat
// square, not pre-rounded.
async function renderOnWhite(size: number, outFile: string) {
  await sharp(markColor)
    .resize(Math.round(size * 0.72), Math.round(size * 0.72))
    .toBuffer()
    .then((mark) =>
      sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: "#FFFFFF",
        },
      })
        .composite([{ input: mark, gravity: "center" }])
        .png()
        .toFile(path.join(iconsDir, outFile)),
    );
}

async function main() {
  await renderTransparent(192, "icon-192.png");
  await renderTransparent(512, "icon-512.png");
  await renderOnWhite(180, "apple-touch-icon.png");
  console.log("Regenerated icon-192.png, icon-512.png, apple-touch-icon.png, icon.svg from mark-color.svg");
}

main();
