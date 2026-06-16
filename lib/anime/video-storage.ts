import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type AnimeVideoUploadMode = "direct" | "server";

export function animeVideoUploadMode(): AnimeVideoUploadMode {
  return isR2Configured() ? "direct" : "server";
}

function r2AccountId() {
  return (process.env.R2_ACCOUNT_ID ?? "").trim();
}

function r2Bucket() {
  return (process.env.R2_BUCKET_NAME ?? process.env.ANIME_VIDEO_BUCKET ?? "").trim();
}

function r2AccessKey() {
  return (process.env.R2_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID ?? "").trim();
}

function r2SecretKey() {
  return (
    process.env.R2_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY ?? ""
  ).trim();
}

export function isR2Configured(): boolean {
  return Boolean(r2AccountId() && r2Bucket() && r2AccessKey() && r2SecretKey());
}

function r2Endpoint() {
  const explicit = (process.env.R2_ENDPOINT ?? process.env.S3_ENDPOINT ?? "").trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `https://${r2AccountId()}.r2.cloudflarestorage.com`;
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: (process.env.R2_REGION ?? process.env.S3_REGION ?? "auto").trim(),
      endpoint: r2Endpoint(),
      credentials: {
        accessKeyId: r2AccessKey(),
        secretAccessKey: r2SecretKey(),
      },
    });
  }
  return s3Client;
}

export function animeUploadsDir() {
  return path.join(process.cwd(), "data", "uploads", "anime");
}

export function buildAnimeStorageKey(episodeId: string, fileName: string) {
  const ext = path.extname(fileName || "").toLowerCase();
  const safeExt = [".mp4", ".webm", ".mov", ".m4v"].includes(ext) ? ext : ".mp4";
  return `anime/${episodeId}${safeExt}`;
}

export function localAnimeFilePath(storageKey: string) {
  const safe = storageKey.replace(/[^a-zA-Z0-9/._-]/g, "_");
  return path.join(animeUploadsDir(), safe);
}

export async function createAnimeUploadTarget(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{
  episodeId: string;
  storageKey: string;
  uploadUrl: string;
  uploadMode: "direct";
  expiresInSec: number;
}> {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured");
  }

  const episodeId = randomUUID();
  const storageKey = buildAnimeStorageKey(episodeId, input.fileName);
  const expiresInSec = 3600;

  const command = new PutObjectCommand({
    Bucket: r2Bucket(),
    Key: storageKey,
    ContentType: input.mimeType || "video/mp4",
    ContentLength: input.sizeBytes,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: expiresInSec });

  return {
    episodeId,
    storageKey,
    uploadUrl,
    uploadMode: "direct",
    expiresInSec,
  };
}

export async function uploadAnimeVideoLocal(
  storageKey: string,
  buffer: Buffer,
): Promise<void> {
  const filePath = localAnimeFilePath(storageKey);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

export async function getAnimeVideoPlayback(input: {
  storageKey: string;
  mimeType: string;
  fileName?: string;
}): Promise<
  | { kind: "redirect"; url: string }
  | { kind: "file"; filePath: string; mimeType: string }
> {
  if (isR2Configured()) {
    const command = new GetObjectCommand({
      Bucket: r2Bucket(),
      Key: input.storageKey,
    });
    const url = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
    return { kind: "redirect", url };
  }

  const filePath = localAnimeFilePath(input.storageKey);
  if (fs.existsSync(filePath)) {
    return { kind: "file", filePath, mimeType: input.mimeType || "video/mp4" };
  }

  // Legacy local files keyed by episode id + original file name
  if (input.fileName) {
    const legacyId = input.storageKey.split("/").pop()?.split(".")[0] ?? "";
    const legacyPath = path.join(
      animeUploadsDir(),
      `${legacyId}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
    );
    if (fs.existsSync(legacyPath)) {
      return { kind: "file", filePath: legacyPath, mimeType: input.mimeType || "video/mp4" };
    }
  }

  throw new Error("Video file not found");
}
