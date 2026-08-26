import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { CloudinaryModule } from '@/cloudinary/cloudinary.module';
import { UploadRepository } from './upload.repository';

@Module({
  imports: [CloudinaryModule],
  controllers: [UploadController],
  providers: [UploadService, UploadRepository],
})
export class UploadModule {}
