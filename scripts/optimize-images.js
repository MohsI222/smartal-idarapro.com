import imagemin from "imagemin";
import imageminMozjpeg from "imagemin-mozjpeg";
import imageminPngquant from "imagemin-pngquant";
import imageminSvgo from "imagemin-svgo";
import fs from "fs";
import path from "path";

async function run() {
  const publicDir = path.resolve(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) {
    console.error("public/ directory not found");
    process.exit(1);
  }

  const patterns = [
    path.join(publicDir, "*.png"),
    path.join(publicDir, "*.jpg"),
    path.join(publicDir, "*.jpeg"),
    path.join(publicDir, "*.svg"),
    path.join(publicDir, "favicon.*"),
  ];

  try {
    const files = await imagemin(patterns, {
      destination: publicDir,
      plugins: [
        imageminMozjpeg({ quality: 80 }),
        imageminPngquant({ quality: [0.6, 0.8] }),
        imageminSvgo({
          plugins: [{ name: "preset-default" }],
        }),
      ],
    });
    console.log(`Optimized ${files.length} files in public/`);
  } catch (e) {
    console.error("Image optimization failed:", e);
    process.exit(1);
  }
}

run();
