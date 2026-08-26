export enum InvoicePaymentStatus {
  PAID = 'PAID',
  UNPAID = 'UNPAID',
}

export interface InvoiceOrderItem {
  productName: string;
  variantName: string;
  quantity: number;
  price: string;
}

export interface InvoiceStructure {
  invoiceNumber: string;
  issuedAt: Date;
  OrderedItem: InvoiceOrderItem[];
  ShippingAddress: string; //complete address
  subtotalIdr: string;
  shippingCostIdr: string;
  totalIdr: string;
  PaymentMethod: string;
  InvoicePaymentStatus: InvoicePaymentStatus; //only paid or unpaid
}
