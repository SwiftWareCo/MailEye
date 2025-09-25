"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { SidebarNavigation } from "./SidebarNavigation"

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex h-16 items-center justify-between px-4 border-b border-border bg-black/40 backdrop-blur-sm">
      <Link href="/dashboard" className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="MailEye Logo"
          className="h-8 w-8 object-contain"
        />
        <span className="text-lg font-semibold text-foreground">MailEye</span>
      </Link>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Open navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            <SheetHeader className="px-6 py-4">
              <SheetTitle className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="MailEye Logo"
                  className="h-6 w-6 object-contain"
                />
                MailEye
              </SheetTitle>
            </SheetHeader>
            <Separator />
            <nav className="flex-1 px-4 py-4">
              <div onClick={() => setIsOpen(false)}>
                <SidebarNavigation />
              </div>
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}