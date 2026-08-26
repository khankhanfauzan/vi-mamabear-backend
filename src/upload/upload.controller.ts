import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { UploadService } from './upload.service';
import { CreateUploadDto } from './dto/create-upload.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/generated/prisma';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('upload (admin)')
@UseGuards(JwtAuthGuard)
@Roles([Role.ADMIN])
@Controller('admin/upload')
@ApiBearerAuth('JwtAuthGuard')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('signature')
  getUploadSignature() {
    return this.uploadService.getUploadSignature();
  }

  @Post('image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: {
        fileSize: 40 * 1024 * 1024,
      },
      fileFilter(req, file, callback) {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(new BadRequestException('Invalid file type'), false);
        }
        callback(null, true);
      },
    }),
  )
  uploadSingleImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadService.uploadImage(file);
  }

  @Post('images')
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      limits: {
        fileSize: 40 * 1024 * 1024,
      },
      fileFilter(req, file, callback) {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(new BadRequestException('Invalid file type'), false);
        }
        callback(null, true);
      },
    }),
  )
  uploadMultipleImages(
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.uploadService.uploadImages(files);
  }

  @Delete('image/:id')
  deleteImage(@Param('id') imageId: number) {
    return this.uploadService.deleteImage(imageId);
  }

  @Get('images')
  findAllImages() {
    return this.uploadService.findAll();
  }
}
