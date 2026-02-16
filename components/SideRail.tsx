"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type RailItem = {
  href: "/" | "/topics" | "/admin/topics";
  label: string;
  icon: string;
  adminOnly?: boolean;
};

const RAIL_ITEMS: RailItem[] = [
  { href: "/", label: "대시보드", icon: "🏠" },
  { href: "/topics", label: "토픽", icon: "💬" },
  { href: "/admin/topics", label: "관리", icon: "🛠️", adminOnly: true },
];

export function SideRail({ viewerRole }: { viewerRole?: string }) {
  const pathname = usePathname();

  return (
    <aside className="side-rail" aria-label="사이드 탐색">
      {RAIL_ITEMS.filter((item) => !item.adminOnly || viewerRole === "ADMIN").map((item) => {
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
