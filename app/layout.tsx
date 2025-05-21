import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
// Import the worker component
import { PDFProcessingWorker } from "@/components/pdf-processing-worker"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Nursing Home Management",
  description: "Manage nursing homes, patients, and their data",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
        <PDFProcessingWorker />
      </body>
    </html>
  )
}
