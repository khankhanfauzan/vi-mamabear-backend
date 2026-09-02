import 'dotenv/config';
import * as crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Product } from '../src/generated/prisma/client';

import { products, users, categories, highlights } from './data';

import { EmbeddingsService } from '@/embeddings/embeddings.service';
import { getCloudinaryImage, uploadLocalImage } from './helper/cloudinary.seed';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

const REVIEW_TITLES = [
  'Bagus sekali!',
  'Sangat membantu',
  'Lumayan',
  'Produknya enak',
  'ASI lancar',
  'Recommended banget',
  'Cocok untuk busui',
  'Kualitas oke',
  'Puas dengan hasilnya',
  'Worth it',
  'Rasanya enak',
  'Efeknya terasa',
  'Sangat puas',
  'Good product',
  'Manfaatnya nyata',
];

const REVIEW_DESCRIPTIONS = [
  'Setelah konsumsi rutin, ASI saya jadi lancar.',
  'Rasanya enak dan mudah diseduh.',
  'Produk ini benar-benar membantu produksi ASI.',
  'Awalnya ragu, tapi hasilnya memuaskan.',
  'Packagingnya rapi dan higienis.',
  'Sudah beberapa kali beli dan selalu puas.',
  'Rasanya enak dan tidak terlalu manis.',
  'Harga worth it dengan manfaat yang didapat.',
  'Dokter juga merekomendasikan produk ini.',
  'ASI meningkat drastis setelah 1 minggu.',
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number, daysAhead: number): Date {
  const now = Date.now();
  const offset = randInt(-daysAgo * 86400000, daysAhead * 86400000);
  return new Date(now + offset);
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 5,
  baseDelayMs = 2000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isLast = attempt === maxAttempts;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `[${label}] attempt ${attempt}/${maxAttempts} failed: ${err?.error?.message ?? err?.message ?? err}`,
      );
      if (isLast) throw err;
      console.log(`Retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const TEMP_DIR = path.join(process.cwd(), '.seed-tmp');

async function compressImage(fullPath: string): Promise<string> {
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const tmpPath = path.join(TEMP_DIR, `${crypto.randomUUID()}.webp`);

  let quality = 100;
  while (quality >= 40) {
    await sharp(fullPath).webp({ quality }).toFile(tmpPath);
    const { size } = fs.statSync(tmpPath);
    if (size <= MAX_FILE_SIZE) {
      console.log(
        `  Compressed to ${(size / 1024 / 1024).toFixed(1)}MB (webp quality=${quality})`,
      );
      return tmpPath;
    }
    quality -= 10;
  }

  await sharp(fullPath)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 40 })
    .toFile(tmpPath);
  const { size } = fs.statSync(tmpPath);
  console.log(`  Force-resized to ${(size / 1024 / 1024).toFixed(1)}MB (webp)`);
  return tmpPath;
}

async function uploadSeedImage(imagePath: string) {
  const folder = 'mamabear';
  const normalizedPath = imagePath.replace(/\.[^/.]+$/, '').replace(/\\/g, '/');
  const cloudinaryPublicId = normalizedPath;
  const fullPublicId = `${folder}/${cloudinaryPublicId}`;
  const existing = await getCloudinaryImage(fullPublicId);

  if (existing) {
    return {
      publicId: existing.public_id,
      imageUrl: existing.secure_url,
      width: existing.width,
      height: existing.height,
      fileSize: existing.bytes,
      format: existing.format,
    };
  }

  const fullPath = path.join(process.cwd(), 'assets', 'images', imagePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Image not found: ${fullPath}`);
  }

  const { size } = fs.statSync(fullPath);
  const uploadPath =
    size > MAX_FILE_SIZE ? await compressImage(fullPath) : fullPath;

  const uploaded = await uploadLocalImage(uploadPath, folder, cloudinaryPublicId);

  if (uploadPath !== fullPath) fs.unlinkSync(uploadPath);

  return {
    publicId: uploaded.public_id,
    imageUrl: uploaded.secure_url,
    width: uploaded.width,
    height: uploaded.height,
    fileSize: uploaded.bytes,
    format: uploaded.format,
  };
}

async function main() {
  const embedService = new EmbeddingsService();

  console.log('Seeding database...');

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "Image",
      "ProductVariant",
      "Discount",
      "Review",
      "Product",
      "Category",
      "Highlight",
      "User",
      "Setting",
      "Cart",
      "CartItem",
      "Address"
    RESTART IDENTITY CASCADE;
  `);

  console.log('Creating users...');

  for (const user of users) {
    await prisma.user.create({ data: user });
  }

  console.log(`Inserted ${users.length} users.`);

  console.log('Creating customer addresses...');

  const customerUsers = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true },
  });

  const customerAddresses = [
    {
      userId: customerUsers[0]?.id,
      name: 'Siti Rahayu',
      phone: '081234567890',
      provinceId: 6,
      provinceName: 'DKI Jakarta',
      cityId: 154,
      cityName: 'Jakarta Selatan',
      districtId: 1524,
      districtName: 'Tebet',
      subdistrictId: 15270,
      subdistrictName: 'Tebet',
      postalCode: '12810',
      road: 'Jalan Tebet Barat Dalam V No. 45',
      completeAddress: 'Jalan Tebet Barat Dalam V No. 45, Tebet, Jakarta Selatan, DKI Jakarta 12810',
      detail: 'Rumah dengan pagar putih, depan toko roti',
      usedFor: 'Rumah',
    },
    {
      userId: customerUsers[0]?.id,
      name: 'Kantor Siti',
      phone: '081234567891',
      provinceId: 6,
      provinceName: 'DKI Jakarta',
      cityId: 154,
      cityName: 'Jakarta Pusat',
      districtId: 1526,
      districtName: 'Menteng',
      subdistrictId: 15297,
      subdistrictName: 'Menteng',
      postalCode: '10310',
      road: 'Jalan Menteng Raya No. 120',
      completeAddress: 'Jalan Menteng Raya No. 120, Menteng, Jakarta Pusat, DKI Jakarta 10310',
      detail: null,
      usedFor: 'Kantor',
    },
    {
      userId: customerUsers[1]?.id,
      name: 'Dewi Lestari',
      phone: '081298765432',
      provinceId: 6,
      provinceName: 'DKI Jakarta',
      cityId: 155,
      cityName: 'Jakarta Barat',
      districtId: 1529,
      districtName: 'Kebon Jeruk',
      subdistrictId: 15317,
      subdistrictName: 'Kebon Jeruk',
      postalCode: '11530',
      road: 'Jalan Kebon Jeruk No. 88',
      completeAddress: 'Jalan Kebon Jeruk No. 88, Kebon Jeruk, Jakarta Barat, DKI Jakarta 11530',
      detail: 'Rumah sudut dengan cat warna hijau',
      usedFor: 'Rumah',
    },
    {
      userId: customerUsers[2]?.id,
      name: 'Rumah Rina',
      phone: '082112345678',
      provinceId: 6,
      provinceName: 'DKI Jakarta',
      cityId: 156,
      cityName: 'Jakarta Utara',
      districtId: 1536,
      districtName: 'Penjaringan',
      subdistrictId: 15358,
      subdistrictName: 'Penjaringan',
      postalCode: '14450',
      road: 'Jalan Penjaringan Timur No. 12',
      completeAddress: 'Jalan Penjaringan Timur No. 12, Penjaringan, Jakarta Utara, DKI Jakarta 14450',
      detail: 'Depan sekolah, di dekat masjid',
      usedFor: 'Rumah',
    },
    {
      userId: customerUsers[3]?.id,
      name: 'Rumah Budi',
      phone: '085678901234',
      provinceId: 6,
      provinceName: 'DKI Jakarta',
      cityId: 157,
      cityName: 'Jakarta Timur',
      districtId: 1547,
      districtName: 'Cakarta',
      subdistrictId: 15403,
      subdistrictName: 'Cakarta',
      postalCode: '13930',
      road: 'Jalan Cakarta Raya No. 55',
      completeAddress: 'Jalan Cakarta Raya No. 55, Cakarta, Jakarta Timur, DKI Jakarta 13930',
      detail: 'Rumah berlantai 2 dengan garasi',
      usedFor: 'Rumah',
    },
  ];

  let addressesCreated = 0;
  for (const address of customerAddresses) {
    if (address.userId) {
      await prisma.address.create({ data: address });
      addressesCreated++;
    }
  }

  console.log(`Inserted ${addressesCreated} customer addresses.`);

  console.log('Creating addresses for all accounts...');

  const allUsersForAddresses = await prisma.user.findMany({
    select: { id: true, name: true },
  });

  const baseAddress = {
    phone: '0856123456',
    provinceId: 1,
    provinceName: 'NUSA TENGGARA BARAT (NTB)',
    cityId: 1,
    cityName: 'MATARAM',
    districtId: 3,
    districtName: 'CAKRANEGARA',
    subdistrictId: 20,
    subdistrictName: 'CAKRANEGARA BARAT',
    postalCode: '83239',
    road: 'Jl. Abu Dhabi Sejahtera Selamanya',
    detail: 'Sebelah rumah pak Bari',
    usedFor: 'RUMAHAN',
  };

  let allAccountAddresses = 0;
  for (const user of allUsersForAddresses) {
    await prisma.address.create({
      data: {
        ...baseAddress,
        userId: user.id,
        name: user.name,
        completeAddress: `${baseAddress.road}, ${baseAddress.subdistrictName}, ${baseAddress.districtName}, ${baseAddress.cityName}, ${baseAddress.provinceName} ${baseAddress.postalCode}`,
      },
    });
    allAccountAddresses++;
  }

  console.log(`Inserted ${allAccountAddresses} addresses for all accounts.`);

  console.log('Creating categories...');

  for (const category of categories) {
    await prisma.category.create({ data: { ...category } });
  }

  console.log(`Inserted ${categories.length} categories.`);

  console.log('Creating highlights...');

  for (const highlight of highlights) {
    await prisma.highlight.create({ data: highlight });
  }

  console.log(`Inserted ${highlights.length} highlights.`);

  console.log('Creating products...');

  const createdProducts: Product[] = [];
  const allVariantIds: number[] = [];

  for (const { images, variants, ...productData } of products) {
    type UploadedImage = Awaited<ReturnType<typeof uploadSeedImage>>;

    const uploadedProductImages: Array<{
      uploaded: UploadedImage;
      sortOrder: number;
      altText?: string;
    }> = [];

    if (images?.length) {
      for (const img of images) {
        console.log(`Uploading product image: ${img.imageUrl}`);
        const uploaded = await withRetry(`upload:${img.imageUrl}`, () =>
          uploadSeedImage(img.imageUrl),
        );
        uploadedProductImages.push({
          uploaded,
          sortOrder: img.sortOrder,
          altText: img.altText,
        });
      }
    }

    type UploadedVariant = {
      variantData: (typeof variants)[number] extends { images?: any }
      ? Omit<(typeof variants)[number], 'images'>
      : never;
      uploadedImages: Array<{
        uploaded: UploadedImage;
        sortOrder: number;
        altText?: string;
      }>;
    };

    const uploadedVariants: Array<{
      variantData: any;
      uploadedImages: Array<{
        uploaded: UploadedImage;
        sortOrder: number;
        altText?: string;
      }>;
    }> = [];

    if (variants?.length) {
      for (const { images: variantImages, ...variantData } of variants) {
        const uploadedImages: Array<{
          uploaded: UploadedImage;
          sortOrder: number;
          altText?: string;
        }> = [];

        if (variantImages?.length) {
          for (const img of variantImages) {
            console.log(`Uploading variant image: ${img.imageUrl}`);
            const uploaded = await withRetry(`upload:${img.imageUrl}`, () =>
              uploadSeedImage(img.imageUrl),
            );
            uploadedImages.push({
              uploaded,
              sortOrder: img.sortOrder,
              altText: img.altText,
            });
          }
        }

        uploadedVariants.push({ variantData, uploadedImages });
      }
    }

    const tempProductForEmbedding = { ...productData } as any;
    const embedding = await withRetry(
      `embedding:${(productData as any).name ?? 'product'}`,
      () => embedService.generateEmbeddingsFromProduct(tempProductForEmbedding),
    );

    const product = await prisma.$transaction(
      async (tx) => {
        const createdProduct = await tx.product.create({
          data: { ...productData },
        });

        await tx.$executeRaw`
          UPDATE "Product"
          SET embedding = ${embedService.embeddingArrayToString(embedding)}::vector
          WHERE id = ${createdProduct.id}
        `;

        for (const { variantData, uploadedImages } of uploadedVariants) {
          const variant = await tx.productVariant.create({
            data: {
              ...variantData,
              productId: createdProduct.id,
            },
          });

          for (const { uploaded, sortOrder, altText } of uploadedImages) {
            await tx.image.create({
              data: {
                variantId: variant.id,
                publicId: uploaded.publicId,
                imageUrl: uploaded.imageUrl,
                sortOrder,
                altText,
                width: uploaded.width,
                height: uploaded.height,
                fileSize: uploaded.fileSize,
                format: uploaded.format,
              },
            });
          }
        }

        for (const { uploaded, sortOrder, altText } of uploadedProductImages) {
          await tx.image.create({
            data: {
              productId: createdProduct.id,
              publicId: uploaded.publicId,
              imageUrl: uploaded.imageUrl,
              sortOrder,
              altText,
              width: uploaded.width,
              height: uploaded.height,
              fileSize: uploaded.fileSize,
              format: uploaded.format,
            },
          });
        }

        return createdProduct;
      },
      { timeout: 30000, maxWait: 30000 },
    );

    createdProducts.push(product);

    const createdVariants = await prisma.productVariant.findMany({
      where: { productId: product.id },
      select: { id: true },
    });

    allVariantIds.push(...createdVariants.map((v) => v.id));
  }

  console.log(`Inserted ${products.length} products.`);

  console.log('Creating discounts...');

  const discountedVariantIds = allVariantIds
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.ceil(allVariantIds.length / 2));

  for (const variantId of discountedVariantIds) {
    const isPercent = Math.random() < 0.5;
    const isActive = Math.random() < 0.7;

    const startedAt = isActive ? randomDate(30, 0) : randomDate(0, 30);
    const endsAt = isActive ? randomDate(0, 60) : randomDate(31, 90);

    await prisma.discount.create({
      data: {
        variantId,
        amount: isPercent ? randInt(10, 20) : randInt(5000, 20000),
        isPercent,
        startedAt,
        endsAt,
      },
    });
  }

  console.log(`Inserted ${discountedVariantIds.length} discounts.`);

  console.log('Creating reviews...');

  const nonAdminUsers = await prisma.user.findMany({
    where: { role: 'USER' },
    select: { id: true },
  });

  const reviewerIds = nonAdminUsers.map((u) => u.id);

  let totalReviews = 0;

  for (const product of createdProducts) {
    const reviewCount = randInt(5, 10);

    for (let i = 0; i < reviewCount; i++) {
      await prisma.review.create({
        data: {
          title: pickRandom(REVIEW_TITLES),
          description: pickRandom(REVIEW_DESCRIPTIONS),
          rating: randFloat(3, 5),
          numUpvotes: randInt(0, 50),
          reviewerId: pickRandom(reviewerIds),
          productId: product.id,
        },
      });
    }

    totalReviews += reviewCount;
  }

  console.log(`Inserted ${totalReviews} reviews.`);

  console.log('Creating carts...');

  const allUsers = await prisma.user.findMany({
    select: { id: true },
  });

  const allVariants = await prisma.productVariant.findMany({
    select: { id: true, productId: true, priceIdr: true },
  });

  let totalCartItems = 0;

  for (const user of allUsers) {
    const cart = await prisma.cart.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const itemCount = randInt(2, 4);
    const shuffled = [...allVariants].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, itemCount);

    for (const variant of selected) {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: variant.productId,
          variantId: variant.id,
          quantity: randInt(1, 3),
          price: variant.priceIdr,
        },
      });
    }

    const items = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      select: { quantity: true, price: true },
    });

    const subtotalIdr = items.reduce(
      (sum, item) => sum + item.quantity * Number(item.price),
      0,
    );
    const taxIdr = Math.round(subtotalIdr * 0.11);

    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        subtotalIdr: Math.round(subtotalIdr),
        taxIdr,
        shippingCostIdr: 15000,
        courierName: 'JNE',
        courierCode: 'jne',
        shippingMethod: 'REG',
      },
    });

    totalCartItems += selected.length;
  }

  console.log(
    `Inserted ${allUsers.length} carts with ${totalCartItems} cart items.`,
  );

  console.log('Upserting default settings...');

  const defaultSettings = [
    {
      key: 'courier',
      value: JSON.stringify([
        {
          jne: 'JNE',
          sicepat: 'Sicepat',
          jnt: 'JNT',
          tiki: 'Tiki',
          anteraja: 'Anteraja',
          pos: 'POS',
        },
      ]),
      type: 'json',
      description: 'List of courier available: ',
    },
    {
      key: 'site_name',
      value: 'Mamabear | Untuk Mama',
      type: 'string',
      description: 'Public site name',
    },
    {
      key: 'site_description',
      value: 'Natural lactation support products and supplements',
      type: 'string',
      description: 'Short site description for meta tags',
    },
    {
      key: 'contact_phone',
      value: '+62-812-3456-7890',
      type: 'string',
      description: 'Customer support phone',
    },
    {
      key: 'ig_link',
      value: JSON.stringify({ instagram: '' }),
      type: 'json',
      description: 'Instagram link',
    },
    {
      key: 'tr_link',
      value: JSON.stringify({ linktree: '' }),
      type: 'json',
      description: 'Linktree link',
    },
    {
      key: 'fb_link',
      value: JSON.stringify({ facebook: '' }),
      type: 'json',
      description: 'Facebook link',
    },
    {
      key: 'addr_id',
      value: '69298',
      type: 'string',
      description: 'Address',
    },
    {
      key: 'addr_province',
      value: 'DKI Jakarta',
      type: 'string',
      description: 'Address province',
    },
    {
      key: 'addr',
      value: '69298',
      type: 'string',
      description: 'Address',
    },
    {
      key: 'tax_rate',
      value: '0.12',
      type: 'number',
      description: 'In percent',
    },
    {
      key: 'email',
      value: 'admin@mamabear.id',
      type: 'string',
      description: 'Email dari mamabear',
    },
    {
      key: 'payment_type',
      value: JSON.stringify({
        qris: 'QRIS',
        gopay: 'Gopay',
        debit: 'Debit',
        indomaret: 'Indomaret',
      }),
      type: 'json',
      description: 'Choose available payment type',
    },
    {
      key: 'maint_mode',
      value: 'false',
      type: 'boolean',
      description: 'Toggle to maintenance mode (ACTIVE/INACTIVE)',
    },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: s as any,
      update: s as any,
    });
  }

  console.log(`Upserted ${defaultSettings.length} settings.`);

  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true });

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
