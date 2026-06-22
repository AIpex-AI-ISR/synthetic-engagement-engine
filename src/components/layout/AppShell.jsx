import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppShell() {
  return (
    <div className="min-h-screen relative">
      {/* Fluid gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-violet-50/40 to-rose-50/30" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <Sidebar />

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        <div className="p-8 max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}