"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { RELEASE } from "@/lib/release";

type Viewer = {
  nickname: string;
  role: string;
} | null;

type NavItem = {
  href: "/" | "/topics" | "/me" | "/me/reports" | "/admin/topics";
  label: string;
  icon: string;
  adminOnly?: boolean;
  authOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: "⌂" },
  { href: "/topics", label: "토픽", icon: "◉" },
  { href: "/me", label: "내 활동", icon: "◌", authOnly: true },
  { href: "/admin/topics", label: "관리", icon: "▣", adminOnly: true },
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const mobileBottomNavRef = useRef<HTMLElement | null>(null);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && viewer?.role !== "ADMIN") return false;
    if (item.authOnly && !viewer) return false;
    return true;
  });

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    if (!profileMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!profileMenuRef.current) return;
      if (profileMenuRef.current.contains(event.target as Node)) return;
      setProfileMenuOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const root = document.documentElement;

    const applyLayoutMetrics = () => {
      const topNavHeight = `${Math.ceil(header.getBoundingClientRect().height)}px`;
      root.style.setProperty("--top-nav-height", topNavHeight);

      const mobileBottomNavHeight = mobileBottomNavRef.current
        ? Math.ceil(mobileBottomNavRef.current.getBoundingClientRect().height)
        : 0;
      root.style.setProperty("--mobile-global-nav-height", `${mobileBottomNavHeight}px`);
    };

    applyLayoutMetrics();

    const resizeObserver = new ResizeObserver(() => {
      applyLayoutMetrics();
    });

    resizeObserver.observe(header);
    if (mobileBottomNavRef.current) {
      resizeObserver.observe(mobileBottomNavRef.current);
    }

    window.addEventListener("resize", applyLayoutMetrics);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", applyLayoutMetrics);
      root.style.removeProperty("--top-nav-height");
      root.style.removeProperty("--mobile-global-nav-height");
    };
  }, [viewer, pathname, visibleNavItems.length]);

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
    <>
      <header className="top-nav" ref={headerRef}>
      <div className="top-nav-inner">
        <Link href="/" className="brand-lockup" aria-label="오늘의 이슈 홈">
          <Image
            src="/oi-logo-transparent.png"
            alt="오늘의 이슈 로고"
            width={168}
            height={56}
            className="brand-logo"
            priority
          />
          <span className="release-chip">r{RELEASE}</span>
        </Link>

        <nav className="top-nav-links" aria-label="글로벌 탐색">
          <div className="top-nav-tabs">
            {visibleNavItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={`top-nav-link ${active ? "is-active" : ""}`}>
                  <span className="top-nav-link-icon" aria-hidden>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
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
              <Link className="profile-chip" href="/me" aria-label="내 활동 페이지로 이동">{initials}</Link>
            </div>
          ) : null}

          <div className="profile-menu-wrap" ref={profileMenuRef}>
            <button
              type="button"
              className={`top-nav-link profile-trigger ${profileMenuOpen ? "is-active" : ""}`}
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
            >
              회원정보
            </button>
            {profileMenuOpen ? (
              <div className="profile-menu" role="menu">
                {viewer ? (
                  <>
                    <Link href="/me" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                      내 활동
                    </Link>
                    <button
                      className="profile-menu-item"
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        setProfileMenuOpen(false);
                        await handleLogout();
                      }}
                      disabled={isLoggingOut}
                    >
                      {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/auth/signin" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                      로그인
                    </Link>
                    <Link href="/auth/signup" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                      회원가입
                    </Link>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="모바일 빠른 탐색" ref={mobileBottomNavRef}>
        {visibleNavItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              className={`mobile-bottom-nav-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="mobile-bottom-nav-icon" aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
