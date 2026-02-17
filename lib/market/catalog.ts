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

const CATALOG: MarketProduct[] = [
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

type ProductFilter = {
  zone?: MarketZone;
  activeOnly?: boolean;
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

  return CATALOG.filter((product) => {
    if (filter.zone && product.zone !== filter.zone) return false;

    if (filter.activeOnly) {
      if (!product.isActive) return false;
      if (!isProductWithinWindow(product, now)) return false;
    }

    return true;
  });
}

export function getMarketProductById(productId: string) {
  return CATALOG.find((product) => product.id === productId) ?? null;
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
