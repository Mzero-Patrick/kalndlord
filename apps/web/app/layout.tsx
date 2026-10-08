import type { Metadata } from "next";
import Link from "next/link";
import { DASHBOARD_PATH } from "@kalndlord/shared";
import { currentUser } from "@/lib/session";
import { logOut } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kalndlord",
  description: "Find workspaces and homes, pay rent by MoMo or card, and report maintenance.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">Kalndlord</Link>
          <nav className="nav">
            {user ? (
              <>
                <Link href={DASHBOARD_PATH[user.role]}>Dashboard</Link>
                <form action={logOut}>
                  <button className="secondary" type="submit">Log out</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/signup" className="button">Sign up</Link>
              </>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
