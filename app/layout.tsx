import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { PDFProcessingWorker } from "@/components/pdf-processing-worker"
import { Footer } from "@/components/footer"
import { AuthProvider } from "@/components/providers/auth-provider"
import { AuthGuard } from "@/components/auth-guard"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "NursingCare Pro | Nursing Home Management",
  description: "Secure, reliable nursing home management software for healthcare professionals.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`} suppressHydrationWarning>
        <AuthProvider>
          <AuthGuard>
            <div className="flex-1">
              {children}
            </div>
            <PDFProcessingWorker />
            <Toaster />
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  )
}
