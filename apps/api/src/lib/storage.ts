import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Photo storage: a local or mounted disk (served from /uploads), or an
// S3-compatible bucket such as Cloudflare R2 or AWS S3.
export interface Storage {
  save(data: Buffer, ext: string): Promise<string>;
  remove(key: string): Promise<void>;
  url(key: string): string;
}

export function localStorage(dir: string, publicUrl: string): Storage {
  return {
    async save(data, ext) {
      await fs.mkdir(dir, { recursive: true });
      const key = `${crypto.randomUUID()}.${ext}`;
      await fs.writeFile(path.join(dir, key), data);
      return key;
    },
    async remove(key) {
      await fs.rm(path.join(dir, path.basename(key)), { force: true });
    },
    url: (key) => `${publicUrl}/uploads/${key}`,
  };
}

const CONTENT_TYPE: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export interface S3Settings {
  bucket: string;
  region: string;
  endpoint?: string; // e.g. https://<account>.r2.cloudflarestorage.com for R2
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string; // where the bucket's files can be read, e.g. https://photos.example.rw
}

export function s3Storage(settings: S3Settings): Storage {
  const client = new S3Client({
    region: settings.region,
    endpoint: settings.endpoint,
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
  });
  const base = settings.publicUrl.replace(/\/$/, "");
  return {
    async save(data, ext) {
      const key = `${crypto.randomUUID()}.${ext}`;
      await client.send(
        new PutObjectCommand({
          Bucket: settings.bucket,
          Key: key,
          Body: data,
          ContentType: CONTENT_TYPE[ext] ?? "application/octet-stream",
          CacheControl: "public, max-age=604800, immutable",
        }),
      );
      return key;
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: settings.bucket, Key: path.basename(key) }));
    },
    url: (key) => `${base}/${key}`,
  };
}

// Checks the file's first bytes rather than trusting the declared type.
export function imageExtension(data: Buffer): "jpg" | "png" | "webp" | null {
  if (data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}
