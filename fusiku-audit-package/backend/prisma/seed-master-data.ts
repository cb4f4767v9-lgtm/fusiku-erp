import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Phones', nameZh: '手机', nameAr: 'هواتف', nameUr: 'فونز' },
  { name: 'Screens', nameZh: '屏幕', nameAr: 'شاشات', nameUr: 'اسکرینز' },
  { name: 'Batteries', nameZh: '电池', nameAr: 'بطاريات', nameUr: 'بیٹریاں' },
  { name: 'Speakers', nameZh: '扬声器', nameAr: 'مكبر صوت', nameUr: 'اسپیکر' },
  { name: 'Flex Cables', nameZh: '排线', nameAr: 'كابلات مرنة', nameUr: 'فلیکس کیبلز' },
  { name: 'IC Chips', nameZh: '芯片', nameAr: 'رقائق IC', nameUr: 'آئی سی چپس' },
  { name: 'Back Glass', nameZh: '后盖玻璃', nameAr: 'زجاج خلفي', nameUr: 'بیک گلاس' },
  { name: 'Camera', nameZh: '摄像头', nameAr: 'كاميرا', nameUr: 'کیمرہ' },
  { name: 'Charging Port', nameZh: '充电口', nameAr: 'منفذ الشحن', nameUr: 'چارجنگ پورٹ' },
  { name: 'Motherboard', nameZh: '主板', nameAr: 'اللوحة الأم', nameUr: 'مدر بورڈ' },
  { name: 'Tools', nameZh: '工具', nameAr: 'أدوات', nameUr: 'اوزار' },
  { name: 'Accessories', nameZh: '配件', nameAr: 'إكسسوارات', nameUr: 'ایکسسریز' }
];

const BRANDS = [
  'Apple', 'Samsung', 'Xiaomi', 'Redmi', 'Realme', 'OnePlus', 'Oppo', 'Vivo',
  'Huawei', 'Honor', 'Google', 'Sony', 'Nokia', 'Motorola', 'Asus'
];

const STORAGE_SIZES = [
  { sizeGb: 16, label: '16GB' },
  { sizeGb: 32, label: '32GB' },
  { sizeGb: 64, label: '64GB' },
  { sizeGb: 128, label: '128GB' },
  { sizeGb: 256, label: '256GB' },
  { sizeGb: 512, label: '512GB' },
  { sizeGb: 1024, label: '1TB' }
];

const DEVICE_COLORS = ['Black', 'White', 'Silver', 'Gold', 'Blue', 'Green', 'Red', 'Purple', 'Titanium', 'Graphite'];
const DEVICE_QUALITIES = ['New', 'Open Box', 'A Grade', 'B Grade', 'Refurbished', 'Used', 'For Parts'];
const DEVICE_FAULTS = [
  'Face ID Fault', 'Battery Weak', 'Back Glass Broken', 'Screen Burn', 'Touch Fault',
  'No Signal', 'Camera Fault', 'Charging Issue', 'Speaker Fault', 'Mic Fault'
];

const APPLE_MODELS = [
  { name: 'iPhone 6', year: 2014 }, { name: 'iPhone 6 Plus', year: 2014 },
  { name: 'iPhone 6s', year: 2015 }, { name: 'iPhone 6s Plus', year: 2015 },
  { name: 'iPhone 7', year: 2016 }, { name: 'iPhone 7 Plus', year: 2016 },
  { name: 'iPhone 8', year: 2017 }, { name: 'iPhone 8 Plus', year: 2017 },
  { name: 'iPhone X', year: 2017 }, { name: 'iPhone XS', year: 2018 },
  { name: 'iPhone XS Max', year: 2018 }, { name: 'iPhone XR', year: 2018 },
  { name: 'iPhone 11', year: 2019 }, { name: 'iPhone 11 Pro', year: 2019 }, { name: 'iPhone 11 Pro Max', year: 2019 },
  { name: 'iPhone 12', year: 2020 }, { name: 'iPhone 12 Mini', year: 2020 }, { name: 'iPhone 12 Pro', year: 2020 }, { name: 'iPhone 12 Pro Max', year: 2020 },
  { name: 'iPhone 13', year: 2021 }, { name: 'iPhone 13 Mini', year: 2021 }, { name: 'iPhone 13 Pro', year: 2021 }, { name: 'iPhone 13 Pro Max', year: 2021 },
  { name: 'iPhone 14', year: 2022 }, { name: 'iPhone 14 Plus', year: 2022 }, { name: 'iPhone 14 Pro', year: 2022 }, { name: 'iPhone 14 Pro Max', year: 2022 },
  { name: 'iPhone 15', year: 2023 }, { name: 'iPhone 15 Plus', year: 2023 }, { name: 'iPhone 15 Pro', year: 2023 }, { name: 'iPhone 15 Pro Max', year: 2023 },
  { name: 'iPhone 16', year: 2024 }, { name: 'iPhone 16 Plus', year: 2024 }, { name: 'iPhone 16 Pro', year: 2024 }, { name: 'iPhone 16 Pro Max', year: 2024 },
  { name: 'iPhone 17', year: 2025 }, { name: 'iPhone 17 Air', year: 2025 }, { name: 'iPhone 17 Pro', year: 2025 }, { name: 'iPhone 17 Pro Max', year: 2025 }
];

const SAMSUNG_MODELS = [
  { name: 'Galaxy S6', year: 2015 }, { name: 'Galaxy S7', year: 2016 }, { name: 'Galaxy S8', year: 2017 },
  { name: 'Galaxy S9', year: 2018 }, { name: 'Galaxy S10', year: 2019 }, { name: 'Galaxy S20', year: 2020 },
  { name: 'Galaxy S21', year: 2021 }, { name: 'Galaxy S22', year: 2022 }, { name: 'Galaxy S23', year: 2023 },
  { name: 'Galaxy S24', year: 2024 }, { name: 'Galaxy S24 Ultra', year: 2024 }, { name: 'Galaxy S25', year: 2025 },
  { name: 'Galaxy Note 8', year: 2017 }, { name: 'Galaxy Note 9', year: 2018 }, { name: 'Galaxy Note 10', year: 2019 },
  { name: 'Galaxy Note 20', year: 2020 },
  { name: 'Galaxy A10', year: 2019 }, { name: 'Galaxy A20', year: 2019 }, { name: 'Galaxy A30', year: 2019 },
  { name: 'Galaxy A50', year: 2019 }, { name: 'Galaxy A51', year: 2020 }, { name: 'Galaxy A52', year: 2021 },
  { name: 'Galaxy A53', year: 2022 }, { name: 'Galaxy A54', year: 2023 }, { name: 'Galaxy A55', year: 2024 },
  { name: 'Galaxy A70', year: 2019 }, { name: 'Galaxy A72', year: 2021 },
  { name: 'Galaxy M10', year: 2019 }, { name: 'Galaxy M20', year: 2019 }, { name: 'Galaxy M30', year: 2019 },
  { name: 'Galaxy M51', year: 2020 }, { name: 'Galaxy M52', year: 2021 }, { name: 'Galaxy M53', year: 2022 },
  { name: 'Galaxy F04', year: 2023 }, { name: 'Galaxy F14', year: 2023 }, { name: 'Galaxy F54', year: 2023 },
  { name: 'Galaxy Z Fold 2', year: 2020 }, { name: 'Galaxy Z Fold 3', year: 2021 },
  { name: 'Galaxy Z Fold 4', year: 2022 }, { name: 'Galaxy Z Fold 5', year: 2023 }, { name: 'Galaxy Z Fold 6', year: 2024 },
  { name: 'Galaxy Z Flip', year: 2020 }, { name: 'Galaxy Z Flip 3', year: 2021 }, { name: 'Galaxy Z Flip 4', year: 2022 },
  { name: 'Galaxy Z Flip 5', year: 2023 }, { name: 'Galaxy Z Flip 6', year: 2024 }
];

const ONEPLUS_MODELS = [
  { name: 'OnePlus 1', year: 2014 }, { name: 'OnePlus 2', year: 2015 }, { name: 'OnePlus 3', year: 2016 },
  { name: 'OnePlus 5', year: 2017 }, { name: 'OnePlus 6', year: 2018 }, { name: 'OnePlus 7', year: 2019 },
  { name: 'OnePlus 8', year: 2020 }, { name: 'OnePlus 9', year: 2021 }, { name: 'OnePlus 10', year: 2022 },
  { name: 'OnePlus 11', year: 2023 }, { name: 'OnePlus 12', year: 2024 }
];

const XIAOMI_REDMI_REALME_OPPO_VIVO_MODELS: { brand: string; models: string[] }[] = [
  { brand: 'Xiaomi', models: ['Redmi Note 8', 'Redmi Note 9', 'Redmi Note 10', 'Redmi Note 11', 'Redmi Note 12', 'Redmi Note 13', 'Mi 10', 'Mi 11', 'Mi 12', 'Mi 13', 'POCO X3', 'POCO F3', 'POCO F4'] },
  { brand: 'Redmi', models: ['Redmi 9', 'Redmi 10', 'Redmi 11', 'Redmi 12', 'Redmi 13', 'Redmi Note 8 Pro', 'Redmi Note 9 Pro', 'Redmi Note 10 Pro', 'Redmi Note 11 Pro', 'Redmi Note 12 Pro', 'Redmi K40', 'Redmi K50'] },
  { brand: 'Realme', models: ['Realme 5', 'Realme 6', 'Realme 7', 'Realme 8', 'Realme 9', 'Realme 10', 'Realme 11', 'Realme GT', 'Realme GT 2', 'Realme Narzo 30', 'Realme Narzo 50'] },
  { brand: 'Oppo', models: ['Oppo A15', 'Oppo A54', 'Oppo A74', 'Oppo Reno 5', 'Oppo Reno 6', 'Oppo Find X3', 'Oppo Find X5'] },
  { brand: 'Vivo', models: ['Vivo Y20', 'Vivo Y53', 'Vivo V21', 'Vivo X60', 'Vivo X80'] },
  { brand: 'Huawei', models: ['P30', 'P40', 'P50', 'Mate 40', 'Nova 9'] },
  { brand: 'Honor', models: ['Honor 50', 'Honor 70', 'Honor 90', 'Honor Magic 4'] },
  { brand: 'Google', models: ['Pixel 5', 'Pixel 6', 'Pixel 7', 'Pixel 8'] },
  { brand: 'Sony', models: ['Xperia 1 III', 'Xperia 5 III', 'Xperia 10 IV'] },
  { brand: 'Nokia', models: ['Nokia 8', 'Nokia 9', 'G50', 'X20'] },
  { brand: 'Motorola', models: ['Moto G Power', 'Moto G Stylus', 'Edge 30', 'Razr 2022'] },
  { brand: 'Asus', models: ['ZenFone 8', 'ZenFone 9', 'ROG Phone 5', 'ROG Phone 6'] }
];

const SCREEN_QUALITIES = ['Original', 'OEM', 'Copy', 'Refurbished', 'Glass Change', 'Second Hand'];
const TOOL_BRANDS = ['Mechanic', 'Sunshine', 'Qianli', 'Relife', 'Best', 'Kaisi'];

async function upsertPhoneModel(brandId: string, name: string, year?: number) {
  try {
    const existing = await prisma.phoneModel.findUnique({
      where: { brandId_name: { brandId, name } }
    });
    if (!existing) {
      await prisma.phoneModel.create({
        data: { brandId, name, releaseYear: year ?? null }
      });
    } else if (year && existing.releaseYear === null) {
      await prisma.phoneModel.update({
        where: { id: existing.id },
        data: { releaseYear: year }
      });
    }
  } catch (e: any) {
    if (e.code !== 'P2002') throw e;
  }
}

async function main() {
  await prisma.$executeRawUnsafe(`
    DELETE FROM "PhoneModel" a USING "PhoneModel" b
    WHERE a.id > b.id AND a."brandId" = b."brandId" AND a.name = b.name
  `).catch(() => {});

  for (const c of CATEGORIES) {
    const cat = await prisma.masterCategory.upsert({
      where: { name: c.name },
      update: { nameZh: c.nameZh, nameAr: c.nameAr, nameUr: c.nameUr },
      create: c
    });
    const translations: Array<{ language: string; translatedName: string }> = [];
    if (c.nameZh) translations.push({ language: 'zh', translatedName: c.nameZh });
    if (c.nameAr) translations.push({ language: 'ar', translatedName: c.nameAr });
    if (c.nameUr) translations.push({ language: 'ur', translatedName: c.nameUr });
    for (const tr of translations) {
      await prisma.masterCategoryTranslation.upsert({
        where: { categoryId_language: { categoryId: cat.id, language: tr.language } },
        update: { translatedName: tr.translatedName },
        create: { categoryId: cat.id, language: tr.language, translatedName: tr.translatedName }
      });
    }
  }

  for (const b of BRANDS) {
    await prisma.phoneBrand.upsert({
      where: { name: b },
      update: {},
      create: { name: b }
    });
  }

  for (const s of STORAGE_SIZES) {
    await prisma.storageSize.upsert({
      where: { sizeGb: s.sizeGb },
      update: { label: s.label },
      create: s
    });
  }

  for (const name of DEVICE_COLORS) {
    await prisma.deviceColor.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  for (const name of DEVICE_QUALITIES) {
    await prisma.deviceQuality.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  for (const name of DEVICE_FAULTS) {
    await prisma.deviceFault.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  const appleBrand = await prisma.phoneBrand.findUnique({ where: { name: 'Apple' } });
  if (appleBrand) {
    for (const m of APPLE_MODELS) {
      await upsertPhoneModel(appleBrand.id, m.name, m.year);
    }
  }

  const samsungBrand = await prisma.phoneBrand.findUnique({ where: { name: 'Samsung' } });
  if (samsungBrand) {
    for (const m of SAMSUNG_MODELS) {
      await upsertPhoneModel(samsungBrand.id, m.name, m.year);
    }
  }

  const oneplusBrand = await prisma.phoneBrand.findUnique({ where: { name: 'OnePlus' } });
  if (oneplusBrand) {
    for (const m of ONEPLUS_MODELS) {
      await upsertPhoneModel(oneplusBrand.id, m.name, m.year);
    }
  }

  for (const { brand: brandName, models } of XIAOMI_REDMI_REALME_OPPO_VIVO_MODELS) {
    const brand = await prisma.phoneBrand.findUnique({ where: { name: brandName } });
    if (brand) {
      for (const name of models) {
        await upsertPhoneModel(brand.id, name);
      }
    }
  }

  for (const q of SCREEN_QUALITIES) {
    await prisma.masterScreenQuality.upsert({
      where: { name: q },
      update: {},
      create: { name: q }
    });
  }

  for (const t of TOOL_BRANDS) {
    await prisma.masterToolBrand.upsert({
      where: { name: t },
      update: {},
      create: { name: t }
    });
  }

  console.log('Master data seed completed.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
