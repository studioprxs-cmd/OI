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

type TopicPreview = {
  id: string;
  title: string;
  status?: string;
  _count?: {
    bets?: number;
    votes?: number;
    comments?: number;
  };
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: "⌂" },
  { href: "/topics", label: "토픽", icon: "◉" },
  { href: "/oing", label: "오잉", icon: "◌" },
  { href: "/market", label: "마켓", icon: "▣" },
];

const RECENT_SEARCH_KEY = "oi:recent-searches";

export function TopNav({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);
  const [popularTopics, setPopularTopics] = useState<TopicPreview[]>([]);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!profileMenuOpen && !searchOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const inProfile = profileMenuRef.current?.contains(target);
      const inSearch = searchPanelRef.current?.contains(target);
      if (inProfile || inSearch) return;
      setProfileMenuOpen(false);
      setSearchOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setSearchOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen, searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCH_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRecentKeywords(parsed.filter((item): item is string => typeof item === "string").slice(0, 5));
      }
    } catch {
      setRecentKeywords([]);
    }
  }, []);

  useEffect(() => {
    if (!searchOpen || popularTopics.length > 0) return;

    let aborted = false;

    async function loadPopularTopics() {
      try {
        const res = await fetch("/api/topics", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok || !Array.isArray(json?.data) || aborted) return;

        const ranked = (json.data as TopicPreview[])
          .filter((topic) => topic.status === "OPEN")
          .sort((a, b) => {
            const scoreA = (a._count?.bets ?? 0) * 2 + (a._count?.votes ?? 0) + (a._count?.comments ?? 0);
            const scoreB = (b._count?.bets ?? 0) * 2 + (b._count?.votes ?? 0) + (b._count?.comments ?? 0);
            return scoreB - scoreA;
          })
          .slice(0, 5);

        if (!aborted) {
          setPopularTopics(ranked);
        }
      } catch {
        if (!aborted) setPopularTopics([]);
      }
    }

    loadPopularTopics();
    return () => {
      aborted = true;
    };
  }, [searchOpen, popularTopics.length]);

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

  function runSearch(nextQueryRaw: string) {
    const nextQuery = nextQueryRaw.trim();
    const params = new URLSearchParams(searchParams.toString());

    if (nextQuery) {
      params.set("q", nextQuery);
      const nextRecent = [nextQuery, ...recentKeywords.filter((item) => item !== nextQuery)].slice(0, 5);
      setRecentKeywords(nextRecent);
      try {
        window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(nextRecent));
      } catch {
        // noop
      }
    } else {
      params.delete("q");
    }

    params.delete("status");

    const queryString = params.toString();
    router.push(`/topics${queryString ? `?${queryString}` : ""}`);
    setSearchOpen(false);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runSearch(searchQuery);
  }

  return (
    <>
      <header className="top-nav top-search-only" ref={headerRef}>
        <div className="top-nav-inner top-search-only-inner">
          <Link href="/" className="top-brand-mini" aria-label="홈으로 이동">OI ✦</Link>

          <button
            type="button"
            className="top-search-trigger"
            aria-label="검색 열기"
            onClick={() => {
              setSearchOpen(true);
              setProfileMenuOpen(false);
            }}
          >
            ⌕
          </button>

          <div className="top-search-actions">
            <Link href="/wallet" className="top-wallet-chip" aria-label="포인트 지갑">
              <span aria-hidden>◌</span>
              <span>지갑</span>
            </Link>

            <div className="profile-menu-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className={`top-search-login-btn ${profileMenuOpen ? "is-active" : ""}`}
                onClick={() => {
                  setProfileMenuOpen((prev) => !prev);
                }}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-label={viewer ? `${viewer.nickname} 메뉴` : "로그인 메뉴"}
              >
                {viewer ? `◔ ${viewer.nickname}` : "◔ 로그인"}
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

      {searchOpen ? (
        <div className="top-search-floating-backdrop" aria-hidden>
          <div className="top-search-floating" ref={searchPanelRef} role="dialog" aria-label="검색 플로팅 메뉴">
            <form className="search-field top-search-floating-form" aria-label="검색" onSubmit={handleSearchSubmit} role="search">
              <span aria-hidden>🔎</span>
              <input
                ref={searchInputRef}
                type="search"
                placeholder="⌕ 이슈 검색"
                aria-label="이슈 검색"
                autoComplete="off"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <button type="submit" className="btn btn-primary">검색</button>
            </form>

            {recentKeywords.length > 0 ? (
              <div className="top-search-suggest-block">
                <p>최근 검색</p>
                <div className="top-search-suggest-row">
                  {recentKeywords.map((keyword) => (
                    <button
                      key={`recent-${keyword}`}
                      type="button"
                      className="top-search-chip"
                      onClick={() => {
                        setSearchQuery(keyword);
                        runSearch(keyword);
                      }}
                    >
                      ◦ {keyword}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {popularTopics.length > 0 ? (
              <div className="top-search-suggest-block">
                <p>인기 토픽</p>
                <div className="top-search-suggest-row">
                  {popularTopics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      className="top-search-chip"
                      onClick={() => {
                        setSearchQuery(topic.title);
                        runSearch(topic.title);
                      }}
                    >
                      ✦ {topic.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

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
