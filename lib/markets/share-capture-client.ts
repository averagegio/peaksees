/** X / Open Graph large image dimensions */
export const OG_SHARE_WIDTH = 1200;
export const OG_SHARE_HEIGHT = 630;

/** Letterbox a card snapshot into 1200×630 so the full card is visible on X. */
export async function fitImageBlobToOgCard(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = OG_SHARE_WIDTH;
  canvas.height = OG_SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas unsupported");
  }

  const gradient = ctx.createLinearGradient(0, 0, OG_SHARE_WIDTH, OG_SHARE_HEIGHT);
  gradient.addColorStop(0, "#ecfdf5");
  gradient.addColorStop(0.45, "#f4f4f5");
  gradient.addColorStop(1, "#eef2ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, OG_SHARE_WIDTH, OG_SHARE_HEIGHT);

  const scale = Math.min(
    OG_SHARE_WIDTH / bitmap.width,
    OG_SHARE_HEIGHT / bitmap.height,
  );
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  const x = (OG_SHARE_WIDTH - w) / 2;
  const y = (OG_SHARE_HEIGHT - h) / 2;
  ctx.drawImage(bitmap, x, y, w, h);
  bitmap.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("Image export failed"))),
      "image/png",
    );
  });
}
