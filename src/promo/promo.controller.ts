import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { PromoService } from './promo.service';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';

@Controller()
export class PromoController {
  constructor(private readonly promoService: PromoService) {}

  // Admin endpoints
  @Post('admin/promo')
  create(@Body() createPromoDto: CreatePromoDto) {
    return this.promoService.create(createPromoDto);
  }

  @Get(['admin/promo', 'admin/promos'])
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNumber = page ? parseInt(page, 10) : undefined;
    const limitNumber = limit ? parseInt(limit, 10) : undefined;
    return this.promoService.findAll(pageNumber, limitNumber);
  }

  @Get('admin/promo/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.findOne(id);
  }

  @Patch('admin/promo/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePromoDto: UpdatePromoDto,
  ) {
    return this.promoService.update(id, updatePromoDto);
  }

  @Delete('admin/promo/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.remove(id);
  }
}
