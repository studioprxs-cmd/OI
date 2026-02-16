"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type Viewer = {
  nickname: string;
  role: string;
} | null;

type NavItem = {
  href: "/" | "/topics" | "/admin/topics";
  label: string;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈" },
  { href: "/topics", label: "토픽" },
  { href: "/admin/topics", label: "관리", adminOnly: true },
];

export function TopNav({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.refresh();
      router.push("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const initials = viewer?.nickname.slice(0, 2).toUpperCase() ?? "GU";

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <Link href="/" className="brand-lockup" aria-label="오늘의 이슈 홈">
          <Image
            src="/oi-logo.jpg"
            alt="오늘의 이슈 로고"
            width={168}
            height={56}
            className="brand-logo"
            priority
          />
        </Link>

        <nav className="top-nav-links" aria-label="글로벌 탐색">
          {NAV_ITEMS.filter((item) => !item.adminOnly || viewer?.role === "ADMIN").map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`top-nav-link ${active ? "is-active" : ""}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="top-nav-actions">
          <label className="search-field" aria-label="검색">
            <span>🔎</span>
            <input placeholder="이슈 검색" aria-label="이슈 검색" />
          </label>

          {viewer ? (
            <div className="auth-chip-row">
              <span className="nick-chip">{viewer.nickname}</span>
              <button className="top-nav-link" type="button" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
              </button>
              <button className="profile-chip" type="button">{initials}</button>
            </div>
          ) : (
            <div className="auth-chip-row">
              <Link href="/auth/signin" className="top-nav-link">로그인</Link>
              <Link href="/auth/signup" className="top-nav-link is-active">회원가입</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
