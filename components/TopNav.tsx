"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { RELEASE } from "@/lib/release";

type Viewer = {
  nickname: string;
  role: string;
} | null;

type NavItem = {
  href: "/" | "/topics" | "/me" | "/me/reports" | "/admin/topics";
  label: string;
  adminOnly?: boolean;
  authOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈" },
  { href: "/topics", label: "토픽" },
  { href: "/me", label: "내 활동", authOnly: true },
  { href: "/admin/topics", label: "관리", adminOnly: true },
];

export function TopNav({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const initialSearch = useMemo(() => {
    if (pathname.startsWith("/topics")) {
      return searchParams.get("q") ?? "";
    }
    return "";
  }, [pathname, searchParams]);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

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

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextQuery = searchQuery.trim();
    const params = new URLSearchParams(searchParams.toString());

    if (nextQuery) {
      params.set("q", nextQuery);
    } else {
      params.delete("q");
    }

    params.delete("status");

    const queryString = params.toString();
    router.push(`/topics${queryString ? `?${queryString}` : ""}`);
  }

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
          <span className="release-chip">r{RELEASE}</span>
        </Link>

        <nav className="top-nav-links" aria-label="글로벌 탐색">
          {NAV_ITEMS.filter((item) => {
            if (item.adminOnly && viewer?.role !== "ADMIN") return false;
            if (item.authOnly && !viewer) return false;
            return true;
          }).map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`top-nav-link ${active ? "is-active" : ""}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="top-nav-actions">
          <form className="search-field" aria-label="검색" onSubmit={handleSearchSubmit} role="search">
            <span aria-hidden>🔎</span>
            <input
              type="search"
              placeholder="토픽 제목·설명 검색"
              aria-label="이슈 검색"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </form>

          {viewer ? (
            <div className="auth-chip-row">
              <span className="nick-chip">{viewer.nickname}</span>
              <button className="top-nav-link" type="button" onClick={handleLogout} disabled={isLoggingOut}>
                {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
              </button>
              <Link className="profile-chip" href="/me" aria-label="내 활동 페이지로 이동">{initials}</Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
