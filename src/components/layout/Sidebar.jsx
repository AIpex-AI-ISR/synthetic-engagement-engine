import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, UserCircle, Rocket, CreditCard } from "lucide-react";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Persona Builder", path: "/personas", icon: UserCircle },
  { label: "Active Campaigns", path: "/campaigns", icon: Rocket },
  { label: "Billing", path: "/billing", icon: CreditCard },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 z-40 glass-strong flex flex-col shadow-xl shadow-black/5">
      {/* Logo */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold font-heading text-foreground tracking-tight leading-none">
              Synthetic
            </h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Engagement Engine
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);
            const Icon = item.icon;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 pb-6">
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground font-medium">
            Token Balance
          </p>
          <p className="text-lg font-semibold font-heading text-foreground mt-0.5">
            —
          </p>
        </div>
      </div>
    </aside>
  );
}