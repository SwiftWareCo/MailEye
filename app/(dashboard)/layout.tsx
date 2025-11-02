import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { MobileNavigation } from '@/components/dashboard/MobileNavigation';
import { getUserWithMetadata } from '@/server/auth/auth.data';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserWithMetadata();
  return (
    <div className='min-h-screen bg-background'>
      <div className='flex h-screen'>
        {/* Desktop Sidebar */}
        <div className='hidden lg:flex lg:w-64 lg:flex-col'>
          <DashboardSidebar user={user} />
        </div>

        {/* Main Content Area */}
        <div className='flex flex-1 flex-col overflow-hidden'>
          {/* Mobile Navigation */}
          <div className='lg:hidden'>
            <MobileNavigation />
          </div>

          {/* Page Content */}
          <main className='flex-1 overflow-y-auto'>
            <div className='container mx-auto px-4 py-6 lg:px-8'>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
