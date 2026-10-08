import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";

const MAX_SIDE = 1600;

// Resizes picked photos to at most 1600px and saves them as JPEG, so an
// upload of several photos stays well under the server's request size limit.
// Returns FormData file descriptors ({ uri, name, type }).
export async function photoFiles(assets: ImagePickerAsset[]) {
  return Promise.all(
    assets.map(async (a, i) => {
      const ctx = ImageManipulator.manipulate(a.uri);
      if (Math.max(a.width, a.height) > MAX_SIDE) {
        ctx.resize(a.width >= a.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
      }
      const image = await (await ctx.renderAsync()).saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
      return { uri: image.uri, name: `photo-${i + 1}.jpg`, type: "image/jpeg" };
    }),
  );
}
