/**
 * Setup Wizard Layout
 *
 * Dedicated layout for the setup wizard that overrides the dashboard layout
 * Provides full-page, immersive experience without sidebar or container padding
 */

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen overflow-hidden bg-background">
      {children}
    </div>
  );
}
