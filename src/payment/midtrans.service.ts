import { Injectable } from '@nestjs/common';
const MidtransClient = require('midtrans-client');

@Injectable()
export class MidtransService {
  private snap: InstanceType<typeof MidtransClient.Snap>;
  constructor() {
    this.snap = new MidtransClient.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY!,
      clientKey: process.env.MIDTRANS_CLIENT_KEY!,
    });
  }
  createTransaction(parameter: any) {
    return this.snap.createTransaction(parameter);
  }
}
