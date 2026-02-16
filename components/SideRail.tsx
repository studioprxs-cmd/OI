"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const RAIL_ITEMS = [
  { href: "/", label: "대시보드", icon: "🏠" },
  { href: "/topics", label: "토픽", icon: "💬" },
  { href: "/admin/topics", label: "관리", icon: "🛠️" },
] as const;

export function SideRail() {
  const pathname = usePathname();

  return (
    <aside className="side-rail" aria-label="사이드 탐색">
      {RAIL_ITEMS.map((item) => {
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
