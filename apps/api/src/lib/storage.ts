import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Photo storage. Files sit on local disk for now and are served from /uploads;
// swapping in cloud storage later only changes this file.
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

// Checks the file's first bytes rather than trusting the declared type.
export function imageExtension(data: Buffer): "jpg" | "png" | "webp" | null {
  if (data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}
