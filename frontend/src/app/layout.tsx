import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AppQueryProvider } from '@/lib/queryClient'
import Navbar from '@/components/Navbar'
import Breadcrumbs from '@/components/navbar/Breadcrumbs'
import QuickActionsMenu from '@/components/navbar/QuickActionsMenu'
import ToastContainer from '@/components/notifications/ToastContainer'
import '@/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Dispute Resolver',
  description: 'Resolve civil disputes with AI-powered mediation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navbar />
        <Breadcrumbs />
        <AppQueryProvider>
          {children}
        </AppQueryProvider>
        <QuickActionsMenu />
        <ToastContainer />
      </body>
    </html>
  )
}