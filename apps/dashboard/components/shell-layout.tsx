"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Bot, 
  Landmark, 
  ArrowLeftRight, 
  Shield, 
  Settings 
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { DaemonStatusPill } from "./daemon-status-pill";
import { DaemonBanner } from "./daemon-banner";

const navItems = [
  { name: "Overview", href: "/overview", icon: LayoutDashboard },
  { name: "Fleet", href: "/fleet", icon: Bot },
  { name: "Treasury", href: "/treasury", icon: Landmark },
  { name: "Actions", href: "/actions", icon: ArrowLeftRight },
  { name: "Policies", href: "/policies", icon: Shield },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      {/* LEFT SIDEBAR */}
      <aside className="w-[240px] flex flex-col border-r border-border-subtle bg-surface-1 flex-shrink-0">
        <div className="p-6">
          <div className="font-sans font-semibold text-[13px] tracking-[0.1em] text-accent">
            QUARTERMASTER
          </div>
        </div>
        
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-r-sm transition-colors ${
                  isActive 
                    ? "border-l-2 border-accent bg-surface-2 text-text-primary" 
                    : "border-l-2 border-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                }`}
              >
                <item.icon size={18} strokeWidth={1.5} aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border-subtle flex items-center justify-between">
          <DaemonStatusPill />
          <ThemeToggle />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <DaemonBanner />
        <div className="flex-1 overflow-y-auto p-8 bg-bg">
          {children}
        </div>
      </main>
    </div>
  );
}
