import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const logo = path.join(root, "public/peakprint-transparent.png");
const appDir = path.join(root, "app");

await sharp(logo).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(appDir, "icon.png"));
await sharp(logo).resize(180, 180, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(appDir, "apple-icon.png"));
await sharp(logo).resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(root, "public/favicon.png"));

console.log("Generated app/icon.png, app/apple-icon.png, public/favicon.png");
