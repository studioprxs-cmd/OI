import { getSessionUser } from "@/lib/auth";

import { SideRail } from "./SideRail";
import { TopNav } from "./TopNav";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const viewer = await getSessionUser();

  return (
    <div className="app-shell">
      <TopNav viewer={viewer ? { nickname: viewer.nickname, role: viewer.role } : null} />
      <div className="app-body">
        <SideRail viewerRole={viewer?.role} />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
