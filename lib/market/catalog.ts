import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type MarketZone = "GOODS" | "DIGITAL" | "DEAL" | "GIFT";

export type MarketProduct = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  zone: MarketZone;
  pricePoints: number;
  stock: number | null;
  isActive: boolean;
  availableFrom?: string;
  availableUntil?: string;
  ctaLabel?: string;
};

const DEFAULT_CATALOG: MarketProduct[] = [
  {
    id: "goods-oi-cheer-kit",
    name: "OI 응원 키트",
    description: "한정 응원 타월 + 스티커팩 + 미니 배지 세트",
    imageUrl: "/oi-logo-new.jpg",
    zone: "GOODS",
    pricePoints: 12_000,
    stock: 120,
    isActive: true,
    ctaLabel: "굿즈 구매 알림 받기",
  },
  {
    id: "digital-premium-frame",
    name: "프리미엄 프로필 프레임 (30일)",
    description: "참여 랭크를 강조하는 그린 네온 프레임",
    imageUrl: "/oi-logo-transparent.png",
    zone: "DIGITAL",
    pricePoints: 4_500,
    stock: null,
    isActive: true,
    ctaLabel: "프레임 적용 예약",
  },
  {
    id: "deal-late-night-pack",
    name: "심야 핫딜 팩",
    description: "운영 시간대 한정으로 열리는 초특가 교환팩",
    imageUrl: "/oi-logo.jpg",
    zone: "DEAL",
    pricePoints: 3_200,
    stock: 40,
    isActive: true,
    availableFrom: "2026-02-18T12:00:00+09:00",
    availableUntil: "2026-12-31T23:59:59+09:00",
    ctaLabel: "핫딜 오픈 알림",
  },
  {
    id: "gift-coffee-coupon",
    name: "모바일 커피 교환권",
    description: "기프트존 MVP 연동 전, 수동 지급 베타 슬롯",
    imageUrl: "/oi-logo-new.jpg",
    zone: "GIFT",
    pricePoints: 5_000,
    stock: 25,
    isActive: false,
    ctaLabel: "출시 소식 받기",
  },
];

const PRODUCT_STORE_PATH = path.join(process.cwd(), ".data", "market-products.json");

function cloneProduct(product: MarketProduct): MarketProduct {
  return {
    ...product,
    availableFrom: product.availableFrom,
    availableUntil: product.availableUntil,
    ctaLabel: product.ctaLabel,
  };
}

function ensureStoreDir() {
  const dir = path.dirname(PRODUCT_STORE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function loadCatalogFromStore() {
  try {
    if (!existsSync(PRODUCT_STORE_PATH)) {
      return DEFAULT_CATALOG.map(cloneProduct);
    }

    const raw = readFileSync(PRODUCT_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as MarketProduct[];
    if (!Array.isArray(parsed)) {
      return DEFAULT_CATALOG.map(cloneProduct);
    }

    return parsed
      .filter((item): item is MarketProduct => Boolean(item?.id && item?.name && item?.zone))
      .map(cloneProduct);
  } catch {
    return DEFAULT_CATALOG.map(cloneProduct);
  }
}

function persistCatalog(products: MarketProduct[]) {
  try {
    ensureStoreDir();
    writeFileSync(PRODUCT_STORE_PATH, JSON.stringify(products, null, 2), "utf8");
  } catch {
    // no-op in restricted environments
  }
}

let runtimeCatalog: MarketProduct[] | null = null;

function getRuntimeCatalog() {
  if (!runtimeCatalog) {
    runtimeCatalog = loadCatalogFromStore();
  }
  return runtimeCatalog;
}

type ProductFilter = {
  zone?: MarketZone;
  activeOnly?: boolean;
};

export type NewMarketProductInput = {
  name: string;
  description: string;
  imageUrl: string;
  zone: MarketZone;
  pricePoints: number;
  stock: number | null;
  isActive: boolean;
  availableFrom?: string;
  availableUntil?: string;
  ctaLabel?: string;
};

export function isProductWithinWindow(product: MarketProduct, now: Date = new Date()) {
  const from = product.availableFrom ? new Date(product.availableFrom) : null;
  const until = product.availableUntil ? new Date(product.availableUntil) : null;

  if (from && now < from) return false;
  if (until && now > until) return false;
  return true;
}

export function getMarketProducts(filter: ProductFilter = {}) {
  const now = new Date();

  return getRuntimeCatalog().filter((product) => {
    if (filter.zone && product.zone !== filter.zone) return false;

    if (filter.activeOnly) {
      if (!product.isActive) return false;
      if (!isProductWithinWindow(product, now)) return false;
    }

    return true;
  });
}

export function getMarketProductById(productId: string) {
  return getRuntimeCatalog().find((product) => product.id === productId) ?? null;
}

export function createMarketProduct(input: NewMarketProductInput) {
  const normalizedName = input.name.trim();
  const baseId = normalizedName
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "product";

  const products = getRuntimeCatalog();
  const uniqueSuffix = Date.now().toString(36).slice(-6);
  const id = `${input.zone.toLowerCase()}-${baseId}-${uniqueSuffix}`;

  const created: MarketProduct = {
    id,
    name: normalizedName,
    description: input.description.trim(),
    imageUrl: input.imageUrl.trim() || "/oi-logo-new.jpg",
    zone: input.zone,
    pricePoints: Math.floor(input.pricePoints),
    stock: input.stock,
    isActive: input.isActive,
    availableFrom: input.availableFrom,
    availableUntil: input.availableUntil,
    ctaLabel: input.ctaLabel?.trim() || undefined,
  };

  runtimeCatalog = [created, ...products];
  persistCatalog(runtimeCatalog);
  return created;
}

export function calculateMarketOrderPoints(pricePoints: number, quantity: number) {
  return pricePoints * quantity;
}

export const MARKET_ZONES: Record<MarketZone, string> = {
  GOODS: "굿즈 존",
  DIGITAL: "디지털 존",
  DEAL: "핫딜 존",
  GIFT: "기프트 존",
};
