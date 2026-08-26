import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const PLACEHOLDER_HASH =
  '$2b$10$GSB6xe8g7ZwboE4Xo8mMd.4Zvaq6zFuh3UAzfOZK3rRmzINn99/uK'; // password is "admin"
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function genPublicId(): string {
  return crypto.randomUUID();
}

export const users = [
  {
    email: 'admin@mamabear.id',
    hashedPassword: PLACEHOLDER_HASH,
    name: 'Super Admin',
    phone: '081200001111',
    role: 'SUPERADMIN' as const,
    isVerified: true,
  },
  {
    email: 'admin2@mamabear.id',
    hashedPassword: PLACEHOLDER_HASH,
    name: 'admin mamabear',
    phone: '081200001111',
    role: 'ADMIN' as const,
    isVerified: true,
  },
  {
    email: 'siti.rahayu@email.com',
    hashedPassword: PLACEHOLDER_HASH,
    name: 'Siti Rahayu',
    phone: '081234567890',
    role: 'USER' as const,
    isVerified: true,
  },
  {
    email: 'dewi.lestari@email.com',
    hashedPassword: PLACEHOLDER_HASH,
    name: 'Dewi Lestari',
    phone: '081298765432',
    role: 'USER' as const,
    isVerified: true,
  },
  {
    email: 'rina.wati@email.com',
    hashedPassword: PLACEHOLDER_HASH,
    name: 'Rina Wati',
    phone: '082112345678',
    role: 'USER' as const,
    isVerified: false,
  },
  {
    email: 'budi.santoso@email.com',
    hashedPassword: PLACEHOLDER_HASH,
    name: 'Budi Santoso',
    phone: '085678901234',
    role: 'USER' as const,
    isVerified: true,
  },
];

export const categories = [
  {
    name: 'Maternity Supplies',
    slug: slugify('Maternity Supplies'),
    description: 'Makanan & minuman untuk ibu menyusui',
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'ASI Booster',
    slug: slugify('ASI Booster'),
    description: 'Produk pelancar & peningkat ASI',
    isActive: true,
    sortOrder: 2,
  },
];

export const highlights = [
  {
    name: 'New Additions',
    slug: slugify('New Additions'),
    description: 'Produk terbaru dari MamaBear',
    isActive: true,
  },
  {
    name: 'Recommended',
    slug: slugify('Recommended'),
    description: 'Rekomendasi terbaik untuk Mama',
    isActive: true,
  },
];

export const products = [
  {
    name: 'MamaBear AlmonMix Isi 6 Sachet - Minuman Serbuk dengan Almond - Kaya Nutrisi Untuk Ibu Menyusui BPOM HALAL',
    slug: slugify('MamaBear AlmonMix Isi 6 Sachet'),
    categoryId: 1,
    highlightId: 2,
    description: `MamaBear AlmonMix Isi 6 Sachet
Minuman Almond Kaya Nutrisi dengan Daun Katuk & Daun Kelor.


LACTOSE FREE
TINGGI VITAMIN A, B1, B2, B6, B9 (ASAM FOLAT), B12
TINGGI VITAMIN C & ZAT BESI
TINGGI SERAT PANGAN
MAKRO & MIKRO NUTRISI LENGKAP


Hadir dalam 7 varian rasa:
Cokelat
Choco Hazelnut
Coffee Latte
Strawberry
Vanilla
Matcha
Caramel


Cara penyajian:
Seduh 1 sachet MamaBear AlmonMix dengan 200 ml air hangat.
Dapat ditambahkan es batu jika ingin disajikan dingin.


Ingredients:
Daun Katuk
Daun Kelor
Almond
Ekstrak Ragi


Keunggulan Mamabear AlmonMix:
Efektif meningkatkan produksi dan nutrisi ASI.
Efektif membantu ASI cepat keluar.
Meningkatkan mood untuk membantu mengurangi risiko baby blues.`,
    isActive: true,
    variants: [
      {
        name: 'Cokelat',
        priceIdr: 80000,
        weightG: 180,
        sku: 'AL.MMBR',
        stock: 100,
        sortOrder: 0,
        images: [
          {
            imageUrl: 'AlmonMix/Cokelat/AlmonMix-Cokelat.png',
            sortOrder: 1,
            altText: 'MamaBear AlmonMix Cokelat',
          },
        ],
      },
      {
        name: 'Choco Hazelnut',
        priceIdr: 80000,
        weightG: 180,
        sku: 'AL.MMBR',
        stock: 100,
        sortOrder: 1,
        images: [
          {
            imageUrl: 'AlmonMix/Choco-Hazelnut/AlmonMix-Choco-Hazelnut.png',
            sortOrder: 1,
            altText: 'MamaBear AlmonMix Choco Hazelnut',
          },
        ],
      },
      {
        name: 'Matcha',
        priceIdr: 80000,
        weightG: 180,
        sku: 'AL.MMBR',
        stock: 100,
        sortOrder: 2,
        images: [
          {
            imageUrl: 'AlmonMix/Matcha/AlmonMix-Matcha.png',
            sortOrder: 1,
            altText: 'MamaBear AlmonMix Matcha',
          },
        ],
      },
      {
        name: 'Vanilla',
        priceIdr: 80000,
        weightG: 180,
        sku: 'AL.MMBR',
        stock: 100,
        sortOrder: 3,
        images: [
          {
            imageUrl: 'AlmonMix/Vanilla/AlmonMix-Vanilla.png',
            sortOrder: 1,
            altText: 'MamaBear AlmonMix Vanilla',
          },
        ],
      },
      {
        name: 'Coffee Latte',
        priceIdr: 80000,
        weightG: 180,
        sku: 'AL.MMBR',
        stock: 100,
        sortOrder: 4,
        images: [
          {
            imageUrl: 'AlmonMix/Coffee-Latte/AlmonMix-Coffee-Latte.png',
            sortOrder: 1,
            altText: 'MamaBear AlmonMix Coffee Latte',
          },
        ],
      },
      {
        name: 'Strawberry',
        priceIdr: 80000,
        weightG: 180,
        sku: 'AL.MMBR',
        stock: 100,
        sortOrder: 5,
        images: [
          {
            imageUrl: 'AlmonMix/Strawberry/AlmonMix-Strawberry.png',
            sortOrder: 1,
            altText: 'MamaBear AlmonMix Strawberry',
          },
        ],
      },
      {
        name: 'Caramel',
        priceIdr: 80000,
        weightG: 180,
        sku: 'AL.MMBR',
        stock: 100,
        sortOrder: 6,
        images: [
          {
            imageUrl: 'AlmonMix/Caramel/AlmonMix-Caramel.png',
            sortOrder: 1,
            altText: 'MamaBear AlmonMix Caramel',
          },
        ],
      },
    ],
    images: [
      {
        imageUrl: 'AlmonMix/AlmonMix-01.jpg',
        sortOrder: 1,
        altText: 'MamaBear AlmonMix 01',
      },
      {
        imageUrl: 'AlmonMix/AlmonMix-02.jpg',
        sortOrder: 2,
        altText: 'MamaBear AlmonMix 02',
      },
      {
        imageUrl: 'AlmonMix/AlmonMix-03.jpg',
        sortOrder: 3,
        altText: 'MamaBear AlmonMix 03',
      },
      {
        imageUrl: 'AlmonMix/AlmonMix-04.jpg',
        sortOrder: 4,
        altText: 'MamaBear AlmonMix 04',
      },
      {
        imageUrl: 'AlmonMix/AlmonMix-05.jpg',
        sortOrder: 5,
        altText: 'MamaBear AlmonMix 05',
      },
    ],
  },
  {
    name: 'MamaBear ZoyaMix Rasa Cokelat Isi 10 Sachet - Sereal Kaya Nutrisi untuk Ibu Menyusui Halal BPOM',
    slug: slugify('MamaBear ZoyaMix Rasa Cokelat Isi 10 Sachet'),
    categoryId: 1,
    highlightId: 1,
    description: `MamaBear ZoyaMix Rasa Cokelat Isi 10 Sachet
Sereal Kaya Nutrisi untuk Ibu Menyusui.


MAKRO & MIKRO NUTRISI LENGKAP
SUMBER PROTEIN & ZAT BESI
TINGGI KALSIUM
VIT A, B6, B12, KOLIN, SENG, ZAT BESI


Cara penyajian:
Seduh 1 sachet ZoyaMix dengan 150 ml air hangat.
Dapat ditambahkan es batu jika ingin disajikan dingin.


Ingredients:
Daun Katuk
Kedelai
Daun Kelor
Ekstrak Ragi
Rolled Oat


Keunggulan Mamabear ZoyaMix:
Melancarkan ASI.
Mengentalkan ASI.
Tinggi Kalsium & Zinc.
Kaya Kandungan Omega 3.
Sumber Zat Besi.

*Catatan: mengandung produk turunan sapi.`,
    isActive: true,
    variants: [
      {
        name: 'Cokelat',
        priceIdr: 80000,
        weightG: 300,
        sku: 'ZM.MMBR',
        stock: 100,
        sortOrder: 0,
        images: [
          {
            imageUrl: 'ZoyaMix/Cokelat/ZoyaMix-Cokelat-2.png',
            sortOrder: 1,
            altText: 'MamaBear ZoyaMix Cokelat',
          },
        ],
      },
    ],
    images: [
      {
        imageUrl: 'ZoyaMix/ZoyaMix-01.jpg',
        sortOrder: 1,
        altText: 'MamaBear ZoyaMix 01',
      },
      {
        imageUrl: 'ZoyaMix/ZoyaMix-02.jpg',
        sortOrder: 2,
        altText: 'MamaBear ZoyaMix 02',
      },
      {
        imageUrl: 'ZoyaMix/ZoyaMix-03.jpg',
        sortOrder: 3,
        altText: 'MamaBear ZoyaMix 03',
      },
      {
        imageUrl: 'ZoyaMix/ZoyaMix-04.jpg',
        sortOrder: 4,
        altText: 'MamaBear ZoyaMix 04',
      },
      {
        imageUrl: 'ZoyaMix/ZoyaMix-05.jpg',
        sortOrder: 5,
        altText: 'MamaBear ZoyaMix 05',
      },
      {
        imageUrl: 'ZoyaMix/ZoyaMix-06.jpg',
        sortOrder: 6,
        altText: 'MamaBear ZoyaMix 06',
      },
      {
        imageUrl: 'ZoyaMix/ZoyaMix-07.jpg',
        sortOrder: 7,
        altText: 'MamaBear ZoyaMix 07',
      },
    ],
  },
  {
    name: 'MamaBear Teh Pelancar ASI Isi 20 Sachet - ASI Booster Pelancar Peningkat Produksi ASI BPOM dan Halal',
    slug: slugify('MamaBear Teh Pelancar ASI Isi 20 Sachet'),
    categoryId: 2,
    highlightId: 2,
    description: `MamaBear Teh Pelancar ASI Isi 20 Sachet
ASI Booster & Immunity Tea.


Individual sachet praktis & higienis.
Kantong teh bebas klorin, biodegradable, dan food grade.
Aroma harum menenangkan, relaksASI ala busui.
Tanpa tambahan bahan pengawet.
Rasa manis alami.
Herbal kaya antioksidan.


Hadir dalam 3 varian rasa:
Strawberry
Blueberry


Cara penyajian (1 box isi 20 sachet x @3gr (60gr)):
Seduh dengan 200-300 ml air mendidih/panas, biarkan selama min 10 menit/kuning keemasan.
Dapat ditambahkan madu/gula/lemon, atau bisa juga disajikan dingin.
Konsumsi MamaBear Teh Pelancar ASI 3-4x sehari.


Ingredients:
Fenugreek
Habbatussauda
Kunir
Fennel


Keunggulan Mamabear Teh Pelancar ASI:
Memperlancar aliran ASI.
Meningkatkan produksi & nutrisi ASI.
Meningkatkan lemak ASI & BB bayi (melalui ASI).
Mempercepat pemulihan & meningkatkan daya tahan tubuh (Habbatussauda).

*Catatan: tidak untuk ibu hamil.`,
    isActive: true,
    variants: [
      {
        name: 'Strawberry',
        priceIdr: 65000,
        weightG: 60,
        sku: 'TPA.MMBR',
        stock: 100,
        sortOrder: 0,
        images: [
          {
            imageUrl: 'Teh/Strawberry/Teh-Strawberry-1.png',
            sortOrder: 1,
            altText: 'MamaBear Teh Strawberry 1',
          },
          {
            imageUrl: 'Teh/Strawberry/Teh-Strawberry-2.png',
            sortOrder: 2,
            altText: 'MamaBear Teh Strawberry 2',
          },
          {
            imageUrl: 'Teh/Strawberry/Teh-Strawberry-3.png',
            sortOrder: 3,
            altText: 'MamaBear Teh Strawberry 3',
          },
          {
            imageUrl: 'Teh/Strawberry/Teh-Strawberry-Isi-5.png',
            sortOrder: 4,
            altText: 'MamaBear Teh Strawberry Isi 5',
          },
          {
            imageUrl: 'Teh/Strawberry/Teh-Strawberry-Isi-10.png',
            sortOrder: 5,
            altText: 'MamaBear Teh Strawberry Isi 10',
          },
          {
            imageUrl: 'Teh/Strawberry/Teh-Strawberry-Sachet.png',
            sortOrder: 6,
            altText: 'MamaBear Teh Strawberry Sachet',
          },
        ],
      },
      {
        name: 'Blueberry',
        priceIdr: 65000,
        weightG: 60,
        sku: 'TPA.MMBR',
        stock: 100,
        sortOrder: 1,
        images: [
          {
            imageUrl: 'Teh/Blueberry/Teh-Blueberry-1.png',
            sortOrder: 1,
            altText: 'MamaBear Teh Blueberry 1',
          },
          {
            imageUrl: 'Teh/Blueberry/Teh-Blueberry-2.png',
            sortOrder: 2,
            altText: 'MamaBear Teh Blueberry 2',
          },
          {
            imageUrl: 'Teh/Blueberry/Teh-Blueberry-Sachet.png',
            sortOrder: 3,
            altText: 'MamaBear Teh Blueberry Sachet',
          },
        ],
      },
    ],
    images: [
      {
        imageUrl: 'Teh/Lactation-Tea-01.jpg',
        sortOrder: 1,
        altText: 'MamaBear Lactation Tea 01',
      },
      {
        imageUrl: 'Teh/Lactation-Tea-02.jpg',
        sortOrder: 2,
        altText: 'MamaBear Lactation Tea 02',
      },
      {
        imageUrl: 'Teh/Lactation-Tea-03.jpg',
        sortOrder: 3,
        altText: 'MamaBear Lactation Tea 03',
      },
    ],
  },
  {
    name: 'MamaBear Kukis Almond Oat - Camilan Kaya Nutrisi untuk Ibu Menyusui Halal BPOM',
    slug: slugify('MamaBear Kukis Almond Oat'),
    categoryId: 2,
    highlightId: 1,
    description: `MamaBear Kukis Almon Oat
Memberi segala kebaikan untuk Mama selama masa menyusui dengan :

✅ SUPERFOOD meningkatkan produksi & nutrisi ASI
✅ MAKRO & MIKRONUTRISI lengkap untuk Mama
✅ VIT B6, Omega3 & Zat Besi
✅ ANTIOXIDANT Selenium
✅ Tinggi Serat Pangan untuk kesehatan saluran pencernaan


Keunggulan lainnya :
⭐ Brand Choice 2022
⭐Terjamin Mutu & Sesuai Standard Keamanan Pangan

- BPOM MD : 236213003799
- HALAL MUI : 07200046370418

⭐ Rasa ENAK
⭐ Tanpa tambahan bahan pengawet
⭐ Ukuran sekali lahap bebas remahan
⭐ Packaging ziplock, memudahkan penyimpanan
⭐ Aman dikonsumsi ibu hamil & menyusui, anak-anak, dewasa, & orang tua.


*Varian Cookies and Cream & Coklat Chip mengandung produk turunan susu sapi.
*Varian Choconut BEBAS produk turunan susu sapi & TANPA TELUR


CATATAN PEMESANAN:
- EstimASI pengiriman produk 3-4 hari kerja
- Bila pemesanan sudah di checkout maka tidak bisa ganti alamat
(Apabila ada kesalahan input alamat, bisa dibatalkan dulu pemesanan sebelumnya lalu bisa order ulang)

*Baca label sebelum membeli

SYARAT PENGAJUAN KOMPLAIN
Jika ada komplain dimohon untuk cek kembali syarat & ketentuannya di BANNER TOKO
Penilaian yang Mama berikan sangat berharga bagi kami`,
    isActive: true,
    variants: [
      {
        name: 'Choco Nut',
        priceIdr: 80000,
        weightG: 150,
        sku: 'KU.MMBR',
        stock: 100,
        sortOrder: 0,
        images: [
          {
            imageUrl: 'Kukis-Almond-Oat/Choco-Nut/Kookie-Bites-Choco-Nut.png',
            sortOrder: 1,
            altText: 'MamaBear Kukis Choco Nut',
          },
        ],
      },
      {
        name: 'Choco Chip',
        priceIdr: 80000,
        weightG: 150,
        sku: 'KU.MMBR',
        stock: 100,
        sortOrder: 1,
        images: [
          {
            imageUrl:
              'Kukis-Almond-Oat/Choco-Chip/Kukis-Almond-Oat-CC-front.png',
            sortOrder: 1,
            altText: 'MamaBear Kukis Choco Chip',
          },
        ],
      },
      {
        name: 'Cookies & Cream',
        priceIdr: 80000,
        weightG: 150,
        sku: 'KU.MMBR',
        stock: 100,
        sortOrder: 2,
        images: [
          {
            imageUrl:
              'Kukis-Almond-Oat/Cookies-Cream/Kukis-Almond-Oat-CnC-front.png',
            sortOrder: 1,
            altText: 'MamaBear Kukis Cookies & Cream',
          },
        ],
      },
    ],
    images: [
      {
        imageUrl: 'Kukis-Almond-Oat/Cover-Kukis-Almond-Oat.png',
        sortOrder: 1,
        altText: 'Cover MamaBear Kukis Almond Oat',
      },
      {
        imageUrl: 'Kukis-Almond-Oat/Almond-Oat-Cookies-Cream-02.jpg',
        sortOrder: 2,
        altText: 'Almond Oat Cookies Cream 02',
      },
      {
        imageUrl: 'Kukis-Almond-Oat/Almond-Oat-Cookies-Cream-03.jpg',
        sortOrder: 3,
        altText: 'Almond Oat Cookies Cream 03',
      },
      {
        imageUrl: 'Kukis-Almond-Oat/Almond-Oat-Cookies-Cream-04.jpg',
        sortOrder: 4,
        altText: 'Almond Oat Cookies Cream 04',
      },
      {
        imageUrl: 'Kukis-Almond-Oat/Almond-Oat-Choco-Chip-03.jpg',
        sortOrder: 5,
        altText: 'Almond Oat Choco Chip 03',
      },
      {
        imageUrl: 'Kukis-Almond-Oat/Kookie-Bites-Choco-Nut-02.jpg',
        sortOrder: 6,
        altText: 'Kookie Bites Choco Nut 02',
      },
      {
        imageUrl: 'Kukis-Almond-Oat/Kookie-Bites-Choco-Nut-04.jpg',
        sortOrder: 7,
        altText: 'Kookie Bites Choco Nut 04',
      },
    ],
  },
  {
    name: 'MamaBear ASI Booster 30 Kapsul - Pelancar ASI Fenugreek Free Halal BPOM',
    slug: slugify('MamaBear ASI Booster 30 Kapsul'),
    categoryId: 2,
    highlightId: 2,
    description: `MAMABEAR KAPSUL ASI BOOSTER

Kapsul Pelancar ASI pertama dengan Triple Benefit dalam 1 kapsul:
Meningkatkan produksi dan nutrisi ASI
Membantu meredakan peradangan pada penyumbatan kelenjar ASI (Mastitis)
Membantu meredakan nyeri pasca melahirkan

Keunggulan lainnya :
Terjamin Mutu & Sesuai Standard Keamanan Pangan
- POM TR243057401
- HALAL MUI : ID00110000288610422

Kombinasi herbal & SUPERFOOD dari ekstrak daun katuk, ekstrak daun kelor, ekstrak jahe merah dan serbuk almond
Fish Allergen Free
Fenugreek Free
17 Nutrisi Makro & Mikro
Ekstrak Jahe untuk antioksida yang membantu menjaga daya tahan tubuh Ibu selama menyusui
Mudah dikonsumsi tidak memerlukan penyeduhan


ANJURAN PEMAKAIAN untuk manfaat maksimal :
- Konsumsi MamaBear Kapsul Pelancar ASI 2-3x sehari.
*1 kapsul setelah makan
Catatan : Tidak untuk Ibu hamil



CATATAN PEMESANAN:
- Estimasi pengiriman produk 3-4 hari kerja
- Bila pemesanan sudah di checkout maka tidak bisa ganti alamat
(Apabila ada kesalahan input alamat, bisa dibatalkan dulu pemesanan sebelumnya lalu bisa order ulang)

*Baca label sebelum membeli`,
    isActive: true,
    variants: [
      {
        name: '30 kapsul',
        priceIdr: 100000,
        weightG: 30,
        sku: 'CP.AB30',
        stock: 100,
        sortOrder: 0,
        images: [
          {
            imageUrl: 'Kapsul/30-Kapsul/Kapsul-ASI-Booster-1.png',
            sortOrder: 1,
            altText: 'MamaBear Kapsul ASI Booster 1',
          },
          {
            imageUrl: 'Kapsul/30-Kapsul/Kapsul-ASI-Booster-2.png',
            sortOrder: 2,
            altText: 'MamaBear Kapsul ASI Booster 2',
          },
          {
            imageUrl: 'Kapsul/30-Kapsul/Kapsul-ASI-Booster-Pill.png',
            sortOrder: 3,
            altText: 'MamaBear Kapsul ASI Booster Pill',
          },
        ],
      },
    ],
    images: [
      {
        imageUrl: 'Kapsul/Kapsul-01.jpg',
        sortOrder: 1,
        altText: 'MamaBear Kapsul 01',
      },
      {
        imageUrl: 'Kapsul/Kapsul-02.jpg',
        sortOrder: 2,
        altText: 'MamaBear Kapsul 02',
      },
      {
        imageUrl: 'Kapsul/Kapsul-03.jpg',
        sortOrder: 3,
        altText: 'MamaBear Kapsul 03',
      },
      {
        imageUrl: 'Kapsul/Kapsul-04.jpg',
        sortOrder: 4,
        altText: 'MamaBear Kapsul 04',
      },
    ],
  },
];
