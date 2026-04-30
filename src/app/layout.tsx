import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT Support Knowledge Base",
  description: "Internal IT support knowledge base with Supabase and Vercel."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
