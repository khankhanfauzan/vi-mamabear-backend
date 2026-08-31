import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressesRepository } from './addresses.repository';
import { Address } from '@/generated/prisma';

@Injectable()
export class AddressesService {
  constructor(private readonly addressesRepository: AddressesRepository) {}
  addMyAddress(userId: string, dto: CreateAddressDto) {
    const address = this.addressesRepository.createAddress(userId, dto);

    if (!address) {
      throw new BadRequestException('Address not created');
    }

    return address;
  }

  async findMyAddresses(userId: string) {
    const myAddresses =
      await this.addressesRepository.findAddressesByUserId(userId);
    console.log(myAddresses);
    if (!myAddresses || myAddresses.length === 0) {
      console.log('No addresses found');
      throw new NotFoundException('Addresses not found');
    }

    return myAddresses;
  }

  async findMyAddress(userId: string, id: number) {
    const myAddress = await this.addressesRepository.findAddressById(id);

    if (!myAddress) {
      throw new NotFoundException('Address not found');
    }

    if (!this.isMyAddress(userId, myAddress)) {
      throw new UnauthorizedException('Address does not belong to user');
    }

    return myAddress;
  }

  async updateMyAddress(userId: string, id: number, dto: UpdateAddressDto) {
    const address = await this.findMyAddress(userId, id);
    const updateResponse = await this.addressesRepository.updateAddress(
      address.userId,
      address.id,
      dto,
    );
    return updateResponse;
  }

  async deleteMyAddress(userId: string, id: number) {
    const address = await this.findMyAddress(userId, id); //exceptions already handled here
    const deleteResponse = await this.addressesRepository.deleteAddress(
      address.id,
    );

    if (!deleteResponse) {
      throw new BadRequestException('Address not deleted');
    }

    return {
      success: true,
      message: `Address deleted successfully`,
      data: null,
    };
  }

  //Utils
  isMyAddress(userId: string, Address: Address) {
    if (Address.userId === userId) return true;
    return false;
  }
}
