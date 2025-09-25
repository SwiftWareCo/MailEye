import { UserDropdown } from "./UserDropdown"
import { SidebarNavigation } from "./SidebarNavigation"
import { UserWithMetadata } from "@/server/auth/auth.data"



interface DashboardSidebarProps {
  user: UserWithMetadata | null
}

export function DashboardSidebar({ user }: DashboardSidebarProps) {


  return (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Header with spacing */}
      <div className="px-6 py-8">
        <h2 className="text-xl font-semibold text-foreground">MailEye</h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4">
        <SidebarNavigation />
      </nav>

      {/* User Section with visual separator */}
      <div className="relative">
        <div className="absolute inset-x-4 -top-px h-px bg-border" />
        <div className="p-4 pt-6">
          {user ? (
            <UserDropdown user={user} />
          ) : (
            <div className="flex items-center gap-3 px-2 py-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="space-y-1">
                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                <div className="h-2 w-16 bg-muted animate-pulse rounded" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}