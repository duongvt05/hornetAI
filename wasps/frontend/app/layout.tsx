import "@/app/globals.css";
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/providers/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "WaspGuard AI - Hệ thống Giám sát Ong Bắp Cày",
  description: "Hệ thống AI và IoT trong phát hiện và theo dõi nguy cơ xâm lấn của ong bắp cày trong môi trường nông nghiệp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AuthGuard>
              {children}
            </AuthGuard>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}