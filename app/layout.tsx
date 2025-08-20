import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'Money Mentor Chat - Financial Freedom Assistant',
  description: 'Expert guidance on budgeting, saving, investing, and building wealth. Unlock financial freedom with tailored advice.',
  keywords: ['money', 'finance', 'investing', 'saving', 'budgeting', 'financial freedom', 'wealth'],
  authors: [{ name: 'Money Mentor' }],
  creator: 'Money Mentor',
  publisher: 'Money Mentor',
  openGraph: {
    title: 'Money Mentor Chat - Financial Freedom Assistant',
    description: 'Expert guidance on budgeting, saving, investing, and building wealth.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Money Mentor Chat - Financial Freedom Assistant',
    description: 'Expert guidance on budgeting, saving, investing, and building wealth.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
