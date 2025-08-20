import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'SLS Pricing Tool - Signage & Graphics Quoting Assistant',
  description: 'Professional quoting assistant for signage installation, manufacturing, and artwork jobs. Get accurate quotes using official pricing benchmarks and markup rules.',
  keywords: ['signage', 'graphics', 'quoting', 'installation', 'manufacturing', 'pricing', 'estimates'],
  authors: [{ name: 'SLS' }],
  creator: 'SLS',
  publisher: 'SLS',
  robots: 'index, follow',
  openGraph: {
    title: 'SLS Pricing Tool - Signage & Graphics Quoting Assistant',
    description: 'Professional quoting assistant for signage installation, manufacturing, and artwork jobs.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SLS Pricing Tool - Signage & Graphics Quoting Assistant',
    description: 'Professional quoting assistant for signage installation, manufacturing, and artwork jobs.',
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
