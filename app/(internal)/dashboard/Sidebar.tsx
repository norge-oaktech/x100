"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◧" },
  { href: "/dashboard/assets", label: "Assets", icon: "▦" },
  { href: "/dashboard/prompt-library", label: "Prompt Library", icon: "▤" },
  { href: "/dashboard/clients", label: "Clients", icon: "◔" },
  { href: "/dashboard/approvals", label: "Approvals", icon: "✓" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">x</div>
        <div className="sidebar-brand-text">x100</div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          // Dashboard should only be "active" on the exact projects list,
          // not on every /dashboard/[projectId] detail page underneath it.
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${isActive ? " active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <form action="/auth/signout" method="post">
          <button className="nav-item" style={{ width: "100%", border: "none", background: "none", cursor: "pointer" }}>
            <span className="nav-icon">→</span>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
