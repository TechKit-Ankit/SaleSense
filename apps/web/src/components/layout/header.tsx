"use client";

import { useState } from "react";
import { Menu, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, activeStore, storeMemberships, switchStore, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  // Fallback for missing DropdownMenu component from shadcn
  const toggleDropdown = () => setShowDropdown(!showDropdown);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
        <div className="flex flex-col">
          <span className="font-semibold text-lg">{activeStore?.name || "Loading..."}</span>
          <span className="text-xs text-muted-foreground hidden sm:inline-block">SaleSense Retail</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Button variant="ghost" className="relative h-8 w-8 rounded-full" onClick={toggleDropdown}>
            <Avatar className="h-8 w-8 border border-border cursor-pointer">
              <AvatarImage src={`https://avatar.vercel.sh/${user?.email || 'user'}`} alt={user?.name || "User"} />
              <AvatarFallback>{user?.name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
          </Button>

          {showDropdown && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowDropdown(false)} 
              />
              <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-background border border-border shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium">{user?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email || user?.phone}</p>
                </div>
                
                {storeMemberships && storeMemberships.length > 1 && (
                  <div className="py-1 border-b border-border">
                    <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Switch Store</p>
                    {storeMemberships.map((membership) => (
                      <button
                        key={membership.storeId}
                        onClick={() => {
                          switchStore(membership.storeId);
                          setShowDropdown(false);
                        }}
                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-muted ${
                          membership.storeId === activeStore?.id ? "text-primary font-medium bg-muted/50" : ""
                        }`}
                      >
                        {membership.store.name}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="py-1">
                  <button
                    onClick={() => {
                      logout();
                      setShowDropdown(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-sm text-destructive hover:bg-muted"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
