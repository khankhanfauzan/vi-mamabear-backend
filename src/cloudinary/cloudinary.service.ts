import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key: process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<{
    imageUrl: string;
    publicId: string;
    width: number;
    height: number;
    fileSize: number;
    format: string;
    altText: string;
  }> {
    try {
      return new Promise((resolve, reject) => {
        const altText = file.originalname.split('.').slice(0, -1).join('.');
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'products',
            transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
          },

          (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve({
                imageUrl: result!.secure_url,
                publicId: result!.public_id,
                width: result!.width,
                height: result!.height,
                fileSize: result!.bytes,
                format: result!.format,
                altText: altText,
              });
            }
          },
        );
        stream.end(file.buffer);
      });
    } catch (error) {
      throw new InternalServerErrorException('Upload ke Cloudinary gagal');
    }
  }

  async uploadMultiple(files: Express.Multer.File[]) {
    return Promise.all(files.map((file) => this.uploadFile(file)));
  }

  async deleteFile(publicId: string) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result !== 'ok') {
        throw new InternalServerErrorException(
          'Gagal menghapus file dari Cloudinary',
        );
      }

      return result;
    } catch (error) {
      throw new InternalServerErrorException(
        'Gagal menghapus file dari Cloudinary',
      );
    }
  }

  async generateUploadSignature() {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'products';

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      process.env.CLOUDINARY_API_SECRET!,
    );

    return {
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    };
  }

  private async validateDimensions(image: {
    publicId: string;
    width: number;
    height: number;
  }) {
    const MIN_WIDTH = 300;
    const MIN_HEIGHT = 300;

    const Max_WIDTH = 5000;
    const Max_HEIGHT = 5000;

    if (image.width < MIN_WIDTH || image.height < MIN_HEIGHT) {
      await this.deleteFile(image.publicId);

      throw new BadRequestException(
        `Image dimensions must be at least ${MIN_WIDTH}x${MIN_HEIGHT}px`,
      );
    }

    if (image.width > Max_WIDTH || image.height > Max_HEIGHT) {
      await this.deleteFile(image.publicId);

      throw new BadRequestException(
        `Image dimensions must be less than ${Max_WIDTH}x${Max_HEIGHT}px`,
      );
    }
  }

  async duplicateImage(imageUrl: string) {
    try {
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder: 'products',
        transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
      });

      return {
        imageUrl: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        fileSize: result.bytes,
        format: result.format,
        altText: '',
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to duplicate image in Cloudinary',
      );
    }
  }
}
