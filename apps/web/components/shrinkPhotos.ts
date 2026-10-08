const MAX_SIDE = 1600;

// Resizes the photos chosen in a file input to at most 1600px JPEGs, in place,
// so an upload of several photos stays under the hosting request size limit.
export async function shrinkPhotos(input: HTMLInputElement) {
  const files = [...(input.files ?? [])];
  if (!files.length || typeof createImageBitmap !== "function") return;
  const out = new DataTransfer();
  for (const [i, file] of files.entries()) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
      // Keep the original when it is already smaller (or can't be converted).
      out.items.add(blob && blob.size < file.size ? new File([blob], `photo-${i + 1}.jpg`, { type: "image/jpeg" }) : file);
    } catch {
      out.items.add(file);
    }
  }
  input.files = out.files;
}
