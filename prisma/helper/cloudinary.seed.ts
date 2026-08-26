import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadLocalImage(
  filePath: string,
  folder: string,
  publicId: string,
) {
  return cloudinary.uploader.upload(filePath, {
    folder,
    public_id: publicId,
    overwrite: false,
    invalidate: false,
    resource_type: 'image',
  });
}

export async function getCloudinaryImage(publicId: string) {
  try {
    const result = await cloudinary.api.resource(publicId);

    return result;
  } catch {
    return null;
  }
}
