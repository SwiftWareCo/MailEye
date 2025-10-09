import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SettingsContent from '@/components/settings/SettingsContent';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Account Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account preferences and personal information.
          </p>
        </div>
      </div>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Account Management</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsContent />
        </CardContent>
      </Card>
    </div>
  );
}
