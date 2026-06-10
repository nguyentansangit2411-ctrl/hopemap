import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from 'react-hot-toast';

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "HopeMap | Bản đồ từ thiện",
  description: "Bản đồ từ thiện cộng đồng giúp kết nối những hoàn cảnh khó khăn với người muốn giúp đỡ tại Việt Nam.",
  openGraph: {
    title: "HopeMap | Bản đồ từ thiện cộng đồng",
    description: "Kết nối những hoàn cảnh khó khăn với người muốn giúp đỡ.",
    url: 'https://hopemap.vn',
    siteName: 'HopeMap',
    images: [
      {
        url: 'https://hopemap.vn/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="vi">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
          <Toaster position="bottom-center" />
        </body>
      </html>
    </ClerkProvider>
  );
}
