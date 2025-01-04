import { EnvVarWarning } from "@/components/env-var-warning";
import HeaderAuth from "@/components/header-auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import Link from "next/link";
import "./globals.css";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/utils/supabase/server";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "boxbrain",
  description: "keep tabs on your orders",
  icons: {
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
    shortcut: { url: "/favicon.svg", type: "image/svg+xml" },
  },
};

const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en" className={geistMono.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="min-h-screen flex flex-col items-center">
            <div className="flex-1 w-full flex flex-col gap-20 items-center">
              <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
                <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
                  <div className="flex gap-5 items-center font-semibold">
                    <Link href={"/"}> 📦 boxbrain</Link>
                  </div>
                  <HeaderAuth />
                </div>
              </nav>
              <div className="flex flex-col gap-20 max-w-5xl p-5">
                {children}
              </div>

              <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
                <div className="flex items-center gap-8">
                  <div className="flex gap-2">
                    Website:<Link href="https://sushispot.xyz" target="_blank">[w]</Link> 
                    Twitter:<Link href="https://x.com/_sushh_" target="_blank">[x]</Link>
                  </div>
                  <ThemeSwitcher />
                  {user && (
                    <form action={signOut}>
                      <Button type="submit" size="sm" variant="ghost" className="text-xs">
                        logout
                      </Button>
                    </form>
                  )}
                </div>
              </footer>
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
