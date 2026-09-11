import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
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

  @Get('admin/promo')
  findAll() {
    return this.promoService.findAll();
  }

  @Get('admin/promo/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.findOne(id);
  }

  @Patch('admin/promo/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() updatePromoDto: UpdatePromoDto) {
    return this.promoService.update(id, updatePromoDto);
  }

  @Delete('admin/promo/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.promoService.remove(id);
  }
}
