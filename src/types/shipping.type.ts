export interface Province {
  id: number;
  name: string;
}

export interface City {
  id: number;
  name: string;
}

export interface District {
  id: number;
  name: string;
}

export interface Subdistrict {
  id: number;
  name: string;
  zipcode: string;
}

export interface Meta {
  message: string;
  code: number;
  status: string;
}

export interface ShippingCost {
  origin: number;
  destination: number;
  weight: number;
  courier: string;
}

export interface ShippingCostResponse {
  name: string;
  code: string;
  service: string;
  description: string;
  cost: number;
  etd: string;
}

export interface Response<T> {
  meta: Meta;
  data: T[];
}
