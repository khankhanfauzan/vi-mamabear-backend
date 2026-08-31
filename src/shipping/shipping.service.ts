import {
  City,
  District,
  Province,
  Response,
  ShippingCostResponse,
  Subdistrict,
} from '@/types/shipping.type';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CalculateShippingCostDto } from './dto/calculate-cost.dto';
import { CartRepository } from '@/cart/cart.repository';
import { ServiceResult } from '@/common/ServiceResult';
@Injectable()
export class ShippingService {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string | undefined;
  private readonly headers: Record<string, string>;
  constructor(private readonly cartRepository: CartRepository) {
    this.apiKey = process.env.RAJAONGKIR_API_KEY ?? '';
    this.baseUrl = process.env.RAJAONGKIR_BASE_URL ?? '';
    this.headers = {
      key: this.apiKey,
      'content-type': 'application/x-www-form-urlencoded',
    };
  }

  async findAllProvince(): Promise<ServiceResult<Province[]>> {
    try {
      const response = await fetch(`${this.baseUrl}/destination/province`, {
        method: 'GET',
        headers: this.headers,
      });
      const data: Response<Province> = await response.json();
      const provinces = data.data;
      return {
        success: true,
        message: `Returned ${provinces.length} provinces`,
        data: provinces,
      };
    } catch (error) {
      throw new Error('Failed to fetch provinces');
    }
  }

  async findCitiesByProvinceId(
    provinceId: string,
  ): Promise<ServiceResult<City[]>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/destination/city/${provinceId}`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );
      const data: Response<City> = await response.json();
      const cities = data.data;
      return {
        success: true,
        message: `Returned ${cities.length} cities for province ID ${provinceId}`,
        data: cities,
      };
    } catch (error) {
      throw new Error('Failed to fetch cities');
    }
  }

  async findDistrictsByCityId(
    cityId: string,
  ): Promise<ServiceResult<District[]>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/destination/district/${cityId}`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );
      const data: Response<District> = await response.json();
      const districts = data.data;
      return {
        success: true,
        message: `Returned ${districts.length} districts for city ID ${cityId}`,
        data: districts,
      };
    } catch (error) {
      throw new Error('Failed to fetch districts');
    }
  }

  async findSubdistrictsByDistrictId(
    districtId: string,
  ): Promise<ServiceResult<Subdistrict[]>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/destination/sub-district/${districtId}`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );
      const data: Response<Subdistrict> = await response.json();
      const subdistricts = data.data;
      return {
        success: true,
        message: `Returned ${subdistricts.length} subdistricts for district ID ${districtId}`,
        data: subdistricts,
      };
    } catch (error) {
      throw new Error('Failed to fetch subdistricts');
    }
  }

  async calculateShippingCost(
    userId: string | undefined,
    dto: CalculateShippingCostDto,
  ) {
    //visit to cart repository function findCartByUser tambah cartId di dto
    const weight = await this.calculateWeight(userId ?? '');
    //visit to admin/setting service untuk fetch warehouse origin and selected courier
    const originId = null; // this should contain function to fetch warehouse origin from admin/setting service
    const courierNames = null;
    try {
      const origin = originId ? originId : 69298; //Sambikerep (Mamabear address in GMaps) sub-district ID. Currently hardcoded. Later need to integrate to website settings for warehouse location
      const courier = courierNames
        ? courierNames
        : 'jne:sicepat:jnt:tiki:anteraja:pos';
      const params = new URLSearchParams();
      params.append('origin', origin.toString());
      params.append('destination', dto.destination.toString());
      params.append('weight', weight.toString()); //remove from dto. fetch from DB (cart repo)
      params.append('courier', courier); //remove from dto. fetch from DB (admin/setting repo)
      params.append('price', dto.priceSortDirection ? dto.priceSortDirection : '');
      const response = await fetch(`${this.baseUrl}/calculate/domestic-cost`, {
        method: 'POST',
        headers: this.headers,
        body: params,
      });
      const data: Response<ShippingCostResponse> = await response.json();
      const shippingCost = data.data;
      return shippingCost;
    } catch (error) {
      throw new Error('Failed to calculate shipping cost');
    }
  }

  async calculateWeight(userId: string) {
    const cart = await this.cartRepository.findCartByUser(userId);
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }
    const weight = cart.items.reduce((total, item) => {
      const itemWeight = item.variant?.weightG ?? 0;
      const quantity = item.quantity ?? 1;

      return total + itemWeight * quantity;
    }, 0);

    return weight;
  }
}
