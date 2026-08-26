import { BadRequestException, Injectable } from '@nestjs/common';
import { UploadRepository } from './upload.repository';
import { CloudinaryService } from '@/cloudinary/cloudinary.service';
import { CreateUploadDto } from './dto/create-upload.dto';
import { ServiceResult } from '@/common/ServiceResult';
import { CreateImageDto } from './dto/create-image.dto';

@Injectable()
export class UploadService {
  constructor(
    private readonly repo: UploadRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}
  async uploadImage(file: Express.Multer.File): Promise<ServiceResult< Omit<CreateImageDto, 'sortOrder'> & { sortOrder: null }> > {
    if (!file) {
      throw new BadRequestException('file needed');
    }

    let result = await this.cloudinary.uploadFile(file);
    return {
      success: true,
      message: 'Image uploaded successfully to cloudinary. Manually assign a unique sortOrder, and append the following metadata to images=[] in entities that have "images" field.',
      data: {
          ...result,
          sortOrder: null,
      },
    };
  }

  async uploadImages(files: Express.Multer.File[]): Promise<ServiceResult<(Omit<CreateImageDto, 'sortOrder'> & { sortOrder: null })[]>> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const images = await Promise.all(
      files.map((file) => this.cloudinary.uploadFile(file)),
    );

    return {
      success: true,
      message: 'Images uploaded successfully to cloudinary. Manual assign a unique sortOrder for each image, and append the following metadata to images=[] in entities that have "images" field.',
      data: images.map(img => ({ ...img, sortOrder: null }) )
    };
  }

  async deleteImage(imageId: number) {
    const image = await this.repo.findById(imageId);

    if (!image) {
      throw new BadRequestException('Image not found');
    }

    await this.cloudinary.deleteFile(image.publicId);

    await this.repo.delete({ id: imageId });

    return {
      success: true,
      message: `Image with ${image.altText} deleted successfully`,
    };
  }

  getUploadSignature() {
    return {
      success: true,
      message: 'Upload signature generated successfully',
      data: this.cloudinary.generateUploadSignature(),
    };
  }

  findAll() {
    return this.repo.findAll();
  }
}
