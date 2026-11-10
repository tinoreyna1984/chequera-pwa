import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Chequera del Banco de la Fe",
    template: "%s — Chequera del Banco de la Fe",
  },
  description:
    "Devocional diario de Charles H. Spurgeon: una promesa de Dios para cada día del año, con recordatorios y lectura sin conexión.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var mq=window.matchMedia("(prefers-color-scheme: dark)");var apply=function(){try{var s=JSON.parse(localStorage.getItem("chequera-appearance")||"{}");var t=s.theme==="dark"||s.theme==="light"?s.theme:"system";var dark=t==="dark"||(t==="system"&&mq.matches);document.documentElement.classList.toggle("dark",dark);if(s.size)document.documentElement.dataset.readerSize=s.size;var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m)}m.setAttribute("content",dark?"#171717":"#fffdf8")}catch(e){}};apply();mq.addEventListener("change",apply)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
