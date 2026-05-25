import "server-only";

import sharp from "sharp";

/** X / Open Graph summary_large_image (1.91:1). */
export const SHARE_OG_WIDTH = 1200;
export const SHARE_OG_HEIGHT = 630;

/**
 * Vertical focus for tall card captures: keeps Yes/No bars, ticker, and top of
 * trade box in frame (matches X link preview crop in reference screenshots).
 */
const CROP_FOCUS_TOP_RATIO = 0.2;

export async function normalizeShareImagePng(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (srcW < 1 || srcH < 1) {
    throw new Error("Invalid share image dimensions");
  }

  const targetAspect = SHARE_OG_WIDTH / SHARE_OG_HEIGHT;
  const srcAspect = srcW / srcH;

  let pipeline = sharp(input);

  if (Math.abs(srcAspect - targetAspect) > 0.02) {
    if (srcAspect > targetAspect) {
      const cropW = Math.max(1, Math.round(srcH * targetAspect));
      const left = Math.max(0, Math.round((srcW - cropW) / 2));
      pipeline = pipeline.extract({ left, top: 0, width: cropW, height: srcH });
    } else {
      const cropH = Math.max(1, Math.round(srcW / targetAspect));
      const maxTop = Math.max(0, srcH - cropH);
      const top = Math.min(maxTop, Math.round(maxTop * CROP_FOCUS_TOP_RATIO));
      pipeline = pipeline.extract({ left: 0, top, width: srcW, height: cropH });
    }
  }

  return pipeline
    .resize(SHARE_OG_WIDTH, SHARE_OG_HEIGHT, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
