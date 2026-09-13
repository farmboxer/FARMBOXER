"use client";

import {
  BookOpen,
  Inbox,
  LayoutDashboard,
  Menu,
  Newspaper,
  Package,
  ScrollText,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "经营看板", icon: LayoutDashboard },
  { href: "/knowledge", label: "知识库", icon: BookOpen },
  { href: "/products", label: "产品与方案", icon: Package },
  { href: "/inbox", label: "WhatsApp 收件箱", icon: Inbox },
  { href: "/market", label: "市场情报", icon: Newspaper },
  { href: "/reviews", label: "三日复盘", icon: ScrollText },
  { href: "/settings", label: "系统设置", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f0e6] text-stone-900">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-emerald-900/10 bg-[#1d3b24] px-4 py-3 text-emerald-50 lg:hidden">
        <div>
          <p className="text-sm font-semibold">FarmBoxer 经营中台</p>
          <p className="text-[11px] text-emerald-100/70">GardenTec / Farm Boxer</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label="菜单">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>
      {open ? (
        <nav className="space-y-1 border-b border-stone-200 bg-white p-3 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                pathname === item.href ? "bg-emerald-800 text-white" : "text-stone-700",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#1d3b24] px-4 py-6 text-emerald-50 lg:flex">
          <div className="mb-8 px-2">
            <p className="text-lg font-semibold leading-tight">FarmBoxer</p>
            <p className="text-xs text-emerald-100/70">WhatsApp 经营中台</p>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                    active ? "bg-emerald-50 text-emerald-950" : "hover:bg-white/10",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <p className="px-2 text-[11px] leading-relaxed text-emerald-100/60">
            毛利底线 ≥15%。看板不编造真实业绩。
          </p>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
