"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  BarChart3,
  ClipboardList,
  Map,
  Store,
  LayoutDashboard,
  Boxes,
  Menu,
  X,
  LogOut,
  User,
  Settings,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppTopbar } from "@/components/app-topbar";

const navItems = [
  { href: "/observations", label: "Capture", icon: ClipboardList },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/map", label: "Map", icon: Map },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/admin/products", label: "Admin · Products", icon: Boxes },
  { href: "/admin/stores", label: "Admin · Stores", icon: Store },
  { href: "/admin/settings", label: "Admin · Settings", icon: Settings },
  { href: "/admin/audit-logs", label: "Admin · Audit Log", icon: ScrollText },
];

const mobileTabItems = [
  { href: "/observations", label: "Capture", icon: ClipboardList },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/map", label: "Map", icon: Map },
  { href: "/stores", label: "Stores", icon: Store },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "FIELD";
  const isAdminOrManager = role === "ADMIN" || role === "MANAGER";

  return (
    <>
      {navItems
        .filter((item) => !item.href.startsWith("/admin") || isAdminOrManager)
        .map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-foreground/10 font-medium" : "hover:bg-foreground/5"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function UserProfileSection({ compact }: { compact?: boolean }) {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className={cn("border-t border-foreground/10 pt-3", compact ? "px-1" : "px-2")}>
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-foreground/10">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium truncate">{session.user.name || session.user.email}</p>
          <p className="text-[10px] text-foreground/50 uppercase tracking-wide">
            {(session.user as { role?: string }).role ?? "FIELD"}
          </p>
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        <span>Sign out</span>
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col border-r border-foreground/10 p-3 gap-2 justify-between">
        <div>
          <div className="px-2 py-3 text-sm font-semibold opacity-90">Retail Evaluator</div>
          <NavLinks pathname={pathname} />
        </div>
        <UserProfileSection />
      </aside>

      {/* Mobile hamburger overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <nav
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-background border-r border-foreground/10 p-3 flex flex-col gap-2 transform transition-transform md:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-2 py-3">
          <span className="text-sm font-semibold">Retail Evaluator</span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            className="p-1 rounded hover:bg-foreground/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1">
          <NavLinks pathname={pathname} onNavigate={() => setMobileMenuOpen(false)} />
        </div>
        <UserProfileSection />
      </nav>

      <div className="min-w-0 pb-16 md:pb-0">
        <AppTopbar onMenuToggle={() => setMobileMenuOpen((v) => !v)} />
        <main className="max-w-6xl mx-auto p-4 md:p-6">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-background border-t border-foreground/10 md:hidden">
        <div className="flex justify-around items-center h-14">
          {mobileTabItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] transition-colors",
                  active
                    ? "text-foreground font-semibold"
                    : "text-foreground/50 hover:text-foreground/70"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
