import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '@/lib/cronInit'; // Initialize cron scheduler
import PWAManager from '@/components/PWAManager';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LegalStanley",
  description: "LegalStanley Administration Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a1a2e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LS Admin" />
        <link rel="apple-touch-icon" href="/Logo.jpg" />
      </head>
      <body className={`${inter.className} h-screen flex`}>
        {children}
        <PWAManager />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          draggable
          theme="light"
          pauseOnHover={false}
          pauseOnFocusLoss={false}
          limit={3}
          containerId="main-toast-container"
          stacked={false}
        />
      </body>
    </html>
  );
}