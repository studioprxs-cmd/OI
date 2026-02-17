"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type RailItem = {
  href: "/" | "/topics" | "/me" | "/admin/topics";
  label: string;
  icon: string;
  adminOnly?: boolean;
  authOnly?: boolean;
};

const RAIL_ITEMS: RailItem[] = [
  { href: "/", label: "대시보드", icon: "🏠" },
  { href: "/topics", label: "토픽", icon: "💬" },
  { href: "/me", label: "내 활동", icon: "🙋", authOnly: true },
  { href: "/admin/topics", label: "관리", icon: "🛠️", adminOnly: true },
];

export function SideRail({ viewerRole }: { viewerRole?: string }) {
  const pathname = usePathname();

  return (
    <aside className="side-rail" aria-label="사이드 탐색">
      {RAIL_ITEMS.filter((item) => {
        if (item.adminOnly && viewerRole !== "ADMIN") return false;
        if (item.authOnly && !viewerRole) return false;
        return true;
      }).map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rail-item ${active ? "is-active" : ""}`}
            aria-label={item.label}
            title={item.label}
          >
            <span aria-hidden>{item.icon}</span>
          </Link>
        );
      })}
    </aside>
  );
}
