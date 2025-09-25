"use client"

import { LogOut, Settings } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { UserWithMetadata } from "@/server/auth/auth.data"
import Link from "next/link"
import { useUser } from "@stackframe/stack"

interface UserDropdownProps {
  user: UserWithMetadata
}

export function UserDropdown({ user }: UserDropdownProps) {

  const user2 = useUser()
  if (!user2) return null;
  const handleSignOut = async () => {
    try {
      user2.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map((name) => name[0])
        .join('')
        .toUpperCase()
        .substring(0, 2)
    : user.primaryEmail?.[0]?.toUpperCase() || 'U'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-3 w-full justify-start px-2 py-3 h-auto"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.profileImageUrl || ''} alt={user.displayName || 'User'} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-sm">
            <span className="font-medium text-foreground">
              {user.displayName || 'User'}
            </span>
            <span className="text-xs text-muted-foreground">
              {user.primaryEmail}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="flex items-center cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}