"use client";

import { useState } from "react";
import { SidebarNav } from "./sidebar-nav";
import { Header } from "./header";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 flex-col border-r bg-background lg:flex">
          <div className="flex h-14 items-center border-b px-4">
            <span className="font-bold text-lg text-primary tracking-tight">SaleSense</span>
          </div>
          <div className="flex-1 overflow-auto py-4 px-3">
            <SidebarNav />
          </div>
        </aside>

        {/* Mobile Sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div 
              className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity" 
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-3/4 max-w-sm flex-col bg-background shadow-xl border-r">
              <div className="flex h-14 items-center justify-between border-b px-4">
                <span className="font-bold text-lg text-primary tracking-tight">SaleSense</span>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close sidebar</span>
                </Button>
              </div>
              <div className="flex-1 overflow-auto py-4 px-3">
                <SidebarNav onItemClick={() => setSidebarOpen(false)} />
              </div>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-muted/10 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
