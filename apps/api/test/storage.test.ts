import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { blobStorage, s3Storage } from "../src/lib/storage";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string) => ({ url: `https://store.public.blob.vercel-storage.com/${pathname}` })),
  del: vi.fn(async () => undefined),
}));
const blob = await import("@vercel/blob");

afterEach(() => vi.restoreAllMocks());

describe("cloud photo storage", () => {
  it("uploads with the right type and builds public links", async () => {
    const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({} as never);
    const storage = s3Storage({
      bucket: "photos",
      region: "auto",
      endpoint: "https://acct.r2.cloudflarestorage.com",
      accessKeyId: "id",
      secretAccessKey: "secret",
      publicUrl: "https://photos.example.rw/",
    });
    const key = await storage.save(Buffer.from("x"), "png");
    expect(key).toMatch(/^[0-9a-f-]{36}\.png$/);
    const put = send.mock.calls[0]![0] as PutObjectCommand;
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect(put.input).toMatchObject({ Bucket: "photos", Key: key, ContentType: "image/png" });
    expect(storage.url(key)).toBe(`https://photos.example.rw/${key}`);

    await storage.remove(`../${key}`);
    const del = send.mock.calls[1]![0] as DeleteObjectCommand;
    expect(del.input).toEqual({ Bucket: "photos", Key: key });
  });
});

describe("Vercel Blob photo storage", () => {
  it("keeps the blob's address as the key and deletes by it", async () => {
    const storage = blobStorage("vercel_blob_rw_test");
    const key = await storage.save(Buffer.from("x"), "jpg");
    expect(key).toMatch(/^https:\/\/store\.public\.blob\.vercel-storage\.com\/photos\/[0-9a-f-]{36}\.jpg$/);
    expect(vi.mocked(blob.put).mock.calls[0]![2]).toMatchObject({ access: "public", contentType: "image/jpeg", token: "vercel_blob_rw_test" });
    expect(storage.url(key)).toBe(key);
    await storage.remove(key);
    expect(blob.del).toHaveBeenCalledWith(key, { token: "vercel_blob_rw_test" });
  });
});
