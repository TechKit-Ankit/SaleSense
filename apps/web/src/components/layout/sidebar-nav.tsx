"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ReceiptText, 
  Package, 
  Boxes, 
  ShoppingCart, 
  Users, 
  BarChart3, 
  Settings 
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "POS / Billing",
    href: "/pos",
    icon: ReceiptText,
  },
  {
    title: "Products",
    href: "/products",
    icon: Package,
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Boxes,
  },
  {
    title: "Purchases",
    href: "/purchases",
    icon: ShoppingCart,
  },
  {
    title: "Customers",
    href: "/customers",
    icon: Users,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Invitations",
    href: "/invitations",
    icon: Users,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  onItemClick?: () => void;
}

export function SidebarNav({ className, onItemClick, ...props }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1",
        className
      )}
      {...props}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (pathname !== "/" && item.href !== "/" && pathname.startsWith(item.href));
        
        return (
          <Link
            key={item.href}
            href={item.href}
            {...(onItemClick ? { onClick: onItemClick } : {})}
            className={cn(
              "flex items-center justify-start rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground",
              isActive ? "bg-muted text-primary" : "text-muted-foreground",
              "justify-start"
            )}
          >
            <Icon className={cn("mr-2 h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
