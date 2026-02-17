"use client";

import { useState } from "react";

import type { MarketZone } from "@/lib/market/catalog";

const ZONES: MarketZone[] = ["GOODS", "DIGITAL", "DEAL", "GIFT"];

type FormState = {
  name: string;
  description: string;
  imageUrl: string;
  zone: MarketZone;
  pricePoints: string;
  stock: string;
  isActive: boolean;
  ctaLabel: string;
};

const INITIAL_STATE: FormState = {
  name: "",
  description: "",
  imageUrl: "/oi-logo-new.jpg",
  zone: "GOODS",
  pricePoints: "1000",
  stock: "",
  isActive: true,
  ctaLabel: "",
};

export function AdminMarketComposer() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const payload = {
      ...form,
      pricePoints: Number(form.pricePoints),
      stock: form.stock.trim() ? Number(form.stock) : null,
    };

    const response = await fetch("/api/market/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      setError(result?.error ?? "상품 등록에 실패했습니다.");
      setPending(false);
      return;
    }

    setMessage(`등록 완료: ${result.data.name}`);
    setForm(INITIAL_STATE);
    setPending(false);
    window.location.reload();
  }

  return (
    <form onSubmit={handleSubmit} className="admin-market-form">
      <div className="admin-market-form-grid">
        <label>
          상품명
          <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} minLength={2} maxLength={60} required />
        </label>
        <label>
          존
          <select value={form.zone} onChange={(event) => setForm((prev) => ({ ...prev, zone: event.target.value as MarketZone }))}>
            {ZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select>
        </label>
        <label>
          가격(pt)
          <input type="number" min={100} step={100} value={form.pricePoints} onChange={(event) => setForm((prev) => ({ ...prev, pricePoints: event.target.value }))} required />
        </label>
        <label>
          재고(미입력=무제한)
          <input type="number" min={0} value={form.stock} onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))} />
        </label>
      </div>

      <label>
        설명
        <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} minLength={4} maxLength={280} rows={3} required />
      </label>

      <div className="admin-market-form-grid">
        <label>
          이미지 URL
          <input value={form.imageUrl} onChange={(event) => setForm((prev) => ({ ...prev, imageUrl: event.target.value }))} />
        </label>
        <label>
          CTA 라벨
          <input value={form.ctaLabel} onChange={(event) => setForm((prev) => ({ ...prev, ctaLabel: event.target.value }))} maxLength={40} />
        </label>
      </div>

      <label className="admin-market-checkbox">
        <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} />
        즉시 판매 상태로 등록
      </label>

      <div className="row" style={{ justifyContent: "space-between", marginTop: "0.55rem" }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "등록 중..." : "상품 등록"}</button>
        {message ? <small style={{ color: "#166534" }}>{message}</small> : null}
        {error ? <small style={{ color: "#b91c1c" }}>{error}</small> : null}
      </div>
    </form>
  );
}
