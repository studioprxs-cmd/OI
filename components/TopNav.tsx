"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Viewer = {
  nickname: string;
  role: string;
} | null;

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: "⌂" },
  { href: "/topics", label: "토픽", icon: "◉" },
  { href: "/oing", label: "오잉", icon: "◌" },
  { href: "/market", label: "마켓", icon: "▣" },
];

export function TopNav({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const quickMenuRef = useRef<HTMLDivElement | null>(null);

  const initialSearch = useMemo(() => {
    if (pathname.startsWith("/topics")) {
      return searchParams.get("q") ?? "";
    }
    return "";
  }, [pathname, searchParams]);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const headerRef = useRef<HTMLElement | null>(null);
  const mobileBottomNavRef = useRef<HTMLElement | null>(null);

  const isNavItemActive = (item: NavItem) => {
    if (item.href === "/") return pathname === "/";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  useEffect(() => {
    setSearchQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    if (!profileMenuOpen && !quickMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const inProfile = profileMenuRef.current?.contains(target);
      const inQuick = quickMenuRef.current?.contains(target);
      if (inProfile || inQuick) return;
      setProfileMenuOpen(false);
      setQuickMenuOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setQuickMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen, quickMenuOpen]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const root = document.documentElement;
    const shell = document.querySelector<HTMLElement>(".app-shell");

    const syncFloatingLayerFlags = (context: {
      isMobile: boolean;
      keyboardVisible: boolean;
      mobileBottomNavHeight: number;
    }) => {
      if (!shell) return;

      const adminDock = shell.querySelector<HTMLElement>(".admin-mobile-dock");
      const resolveSubmitBar = shell.querySelector<HTMLElement>(".resolve-submit-bar");
      const adminDockHeight = adminDock ? Math.ceil(adminDock.getBoundingClientRect().height) : 0;
      const resolveSubmitHeight = resolveSubmitBar ? Math.ceil(resolveSubmitBar.getBoundingClientRect().height) : 0;

      const hasAdminDock = adminDockHeight > 0;
      const hasResolveSubmitBar = resolveSubmitHeight > 0;

      shell.dataset.hasAdminDock = hasAdminDock ? "true" : "false";
      shell.dataset.hasResolveSubmit = hasResolveSubmitBar ? "true" : "false";

      const floatingGapRaw = getComputedStyle(root).getPropertyValue("--mobile-floating-layer-gap").trim();
      const floatingGap = Number.parseFloat(floatingGapRaw || "0") || 0;

      const navLayerHeight = context.isMobile && !context.keyboardVisible ? context.mobileBottomNavHeight : 0;
      const stackOffset = navLayerHeight
        + (hasAdminDock ? adminDockHeight + floatingGap : 0)
        + (hasResolveSubmitBar ? resolveSubmitHeight + floatingGap : 0);

      root.style.setProperty("--mobile-admin-dock-runtime-height", `${adminDockHeight}px`);
      root.style.setProperty("--mobile-resolve-submit-runtime-height", `${resolveSubmitHeight}px`);
      root.style.setProperty("--mobile-floating-stack-offset-runtime", `${Math.ceil(stackOffset)}px`);
    };

    const applyLayoutMetrics = () => {
      const topNavHeight = `${Math.ceil(header.getBoundingClientRect().height)}px`;
      root.style.setProperty("--top-nav-height", topNavHeight);

      const mobileBottomNavHeight = mobileBottomNavRef.current
        ? Math.ceil(mobileBottomNavRef.current.getBoundingClientRect().height)
        : 0;

      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const keyboardInset = window.visualViewport ? Math.max(0, window.innerHeight - window.visualViewport.height) : 0;
      const keyboardVisible = keyboardInset > 120;

      root.style.setProperty("--mobile-global-nav-height", `${isMobile && keyboardVisible ? 0 : mobileBottomNavHeight}px`);
      if (shell) {
        shell.dataset.keyboardVisible = isMobile && keyboardVisible ? "true" : "false";
      }
      syncFloatingLayerFlags({
        isMobile,
        keyboardVisible,
        mobileBottomNavHeight,
      });
    };

    applyLayoutMetrics();

    const resizeObserver = new ResizeObserver(() => {
      applyLayoutMetrics();
    });

    resizeObserver.observe(header);
    if (mobileBottomNavRef.current) {
      resizeObserver.observe(mobileBottomNavRef.current);
    }

    const mutationObserver = new MutationObserver(() => {
      applyLayoutMetrics();
    });

    if (shell) {
      mutationObserver.observe(shell, {
        childList: true,
        subtree: true,
      });
    }

    const viewport = window.visualViewport;

    window.addEventListener("resize", applyLayoutMetrics);
    viewport?.addEventListener("resize", applyLayoutMetrics);
    viewport?.addEventListener("scroll", applyLayoutMetrics);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", applyLayoutMetrics);
      viewport?.removeEventListener("resize", applyLayoutMetrics);
      viewport?.removeEventListener("scroll", applyLayoutMetrics);
      root.style.removeProperty("--top-nav-height");
      root.style.removeProperty("--mobile-global-nav-height");
      root.style.removeProperty("--mobile-admin-dock-runtime-height");
      root.style.removeProperty("--mobile-resolve-submit-runtime-height");
      root.style.removeProperty("--mobile-floating-stack-offset-runtime");
      if (shell) {
        delete shell.dataset.hasAdminDock;
        delete shell.dataset.hasResolveSubmit;
        delete shell.dataset.keyboardVisible;
      }
    };
  }, [pathname]);

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
      <header className="top-nav top-search-only" ref={headerRef}>
        <div className="top-nav-inner top-search-only-inner">
          <Link href="/" className="top-brand-mini" aria-label="홈으로 이동">OI</Link>

          <form className="search-field top-fixed-search" aria-label="검색" onSubmit={handleSearchSubmit} role="search">
            <span aria-hidden>🔎</span>
            <input
              type="search"
              placeholder="이슈/토픽 검색"
              aria-label="이슈 검색"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </form>

          <div className="top-search-actions">
            <div className="profile-menu-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className={`top-search-icon-btn ${profileMenuOpen ? "is-active" : ""}`}
                onClick={() => {
                  setProfileMenuOpen((prev) => !prev);
                  setQuickMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-label={viewer ? `${viewer.nickname} 메뉴` : "로그인 메뉴"}
              >
                ⟲
              </button>
              {profileMenuOpen ? (
                <div className="profile-menu" role="menu">
                  {viewer ? (
                    <>
                      <Link href="/me" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}>
                        {viewer.nickname}
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

            <div className="profile-menu-wrap" ref={quickMenuRef}>
              <button
                type="button"
                className={`top-search-icon-btn ${quickMenuOpen ? "is-active" : ""}`}
                onClick={() => {
                  setQuickMenuOpen((prev) => !prev);
                  setProfileMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={quickMenuOpen}
                aria-label="메뉴"
              >
                ☰
              </button>
              {quickMenuOpen ? (
                <div className="profile-menu" role="menu">
                  {NAV_ITEMS.map((item) => (
                    <Link
                      key={`quick-${item.href}`}
                      href={item.href}
                      className="profile-menu-item"
                      role="menuitem"
                      onClick={() => setQuickMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="모바일 빠른 탐색" ref={mobileBottomNavRef}>
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item);
          return (
            <Link
              key={`mobile-${item.href}`}
              href={item.href}
              className={`mobile-bottom-nav-item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="mobile-bottom-nav-icon" aria-hidden>{item.icon}</span>
              <span className="mobile-bottom-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
