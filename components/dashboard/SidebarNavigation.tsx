"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Settings,
} from "lucide-react"

interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
}


export const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function SidebarNavigation() {
  const pathname = usePathname()

  return (
    <ul className="space-y-2">
      {navigation.map((item: NavigationItem) => {
        const isActive = pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/dashboard')

        return (
          <li key={item.name}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground hover:shadow-sm"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}