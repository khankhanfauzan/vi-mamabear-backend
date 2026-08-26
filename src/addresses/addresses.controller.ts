import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guard/jwt-auth.guard';
import { GetUserId } from '@/common/decorators/get-user-id-decorator';

@ApiTags('addresses')
@ApiBearerAuth('JwtAuthGuard')
@UseGuards(JwtAuthGuard)
@Controller('me/addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  addMyAddress(
    @GetUserId() userId: string,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.addressesService.addMyAddress(userId, createAddressDto);
  }

  @Get()
  findMyAddresses(@GetUserId() userId: string) {
    return this.addressesService.findMyAddresses(userId);
  }

  @Get(':id')
  findMyAddress(@GetUserId() userId: string, @Param('id') id: string) {
    return this.addressesService.findMyAddress(userId, +id);
  }

  @Put(':id')
  updateMyAddress(
    @GetUserId() userId: string,
    @Param('id') id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.addressesService.updateMyAddress(userId, +id, updateAddressDto);
  }

  @Delete(':id')
  deleteMyAddress(@GetUserId() userId: string, @Param('id') id: string) {
    return this.addressesService.deleteMyAddress(userId, +id);
  }
}
