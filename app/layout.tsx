import type { Metadata } from 'next';
import { StackProvider, StackTheme } from '@stackframe/stack';
import { stackServerApp } from '../stack/server';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryProvider } from '@/lib/providers/query-provider';
import './globals.css';

const theme = {
  light: {
    background: 'hsl(0, 0%, 100%)',
    foreground: 'hsl(222.2, 84%, 4.9%)',
    card: 'hsl(0, 0%, 100%)',
    cardForeground: 'hsl(222.2, 84%, 4.9%)',
    popover: 'hsl(0, 0%, 100%)',
    popoverForeground: 'hsl(222.2, 84%, 4.9%)',
    primary: 'hsl(221.2, 83.2%, 53.3%)',
    primaryForeground: 'hsl(210, 40%, 98%)',
    secondary: 'hsl(210, 40%, 96%)',
    secondaryForeground: 'hsl(222.2, 84%, 4.9%)',
    muted: 'hsl(210, 40%, 96%)',
    mutedForeground: 'hsl(215.4, 16.3%, 46.9%)',
    accent: 'hsl(210, 40%, 96%)',
    accentForeground: 'hsl(222.2, 84%, 4.9%)',
    destructive: 'hsl(0, 84.2%, 60.2%)',
    destructiveForeground: 'hsl(210, 40%, 98%)',
    border: 'hsl(214.3, 31.8%, 91.4%)',
    input: 'hsl(214.3, 31.8%, 91.4%)',
    ring: 'hsl(221.2, 83.2%, 53.3%)',
  },
  dark: {
    background: 'hsl(222.2, 84%, 4.9%)',
    foreground: 'hsl(210, 40%, 98%)',
    card: 'hsl(222.2, 84%, 4.9%)',
    cardForeground: 'hsl(210, 40%, 98%)',
    popover: 'hsl(222.2, 84%, 4.9%)',
    popoverForeground: 'hsl(210, 40%, 98%)',
    primary: 'hsl(210, 40%, 98%)',
    primaryForeground: 'hsl(222.2, 84%, 4.9%)',
    secondary: 'hsl(217.2, 32.6%, 17.5%)',
    secondaryForeground: 'hsl(210, 40%, 98%)',
    muted: 'hsl(217.2, 32.6%, 17.5%)',
    mutedForeground: 'hsl(215, 20.2%, 65.1%)',
    accent: 'hsl(217.2, 32.6%, 17.5%)',
    accentForeground: 'hsl(210, 40%, 98%)',
    destructive: 'hsl(0, 62.8%, 30.6%)',
    destructiveForeground: 'hsl(210, 40%, 98%)',
    border: 'hsl(217.2, 32.6%, 17.5%)',
    input: 'hsl(217.2, 32.6%, 17.5%)',
    ring: 'hsl(212.7, 26.8%, 83.9%)',
  },
  radius: '0.5rem',
};

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Maileye AI',
  description: 'Maileye AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <StackProvider app={stackServerApp}>
              <StackTheme theme={theme}>
                {children}
                <Toaster />
              </StackTheme>
            </StackProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
