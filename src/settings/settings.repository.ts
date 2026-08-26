import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { UpdateSettingDto } from './dto/update-setting.dto';

export const SETTING_SELECT = {
  id: true,
  key: true,
  value: true,
  type: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.setting.findMany({ select: SETTING_SELECT });
  }

  findByKey(key: string) {
    return this.prisma.setting.findUnique({
      where: { key },
      select: SETTING_SELECT,
    });
  }

  upsertByKey(key: string, data: UpdateSettingDto) {
    return this.prisma.setting.upsert({
      where: { key },
      create: {
        key,
        value: data.value,
        type: data.type ?? 'string',
        description: data.description ?? null,
      },
      update: {
        value: data.value,
        type: data.type ?? 'string',
        description: data.description ?? null,
      },
      select: SETTING_SELECT,
    });
  }
}
