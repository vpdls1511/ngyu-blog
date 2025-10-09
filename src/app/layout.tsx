import {CMS_NAME, HOME_OG_IMAGE_URL} from '@/lib/constants'
import type {Metadata} from 'next'
import {Inter} from 'next/font/google'

import './globals.css'
import Header from '@/app/_components/layout/header'

const inter = Inter({subsets: ['latin']})

export const metadata: Metadata = {
  title: `ngyu - blog`,
  description: `생각을 코드로, 경험을 글로 - Thoughts into code, experiences into words`,
  openGraph: {
    images: [HOME_OG_IMAGE_URL],
  },
}

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
    <head>
      <link rel="icon" type="image/png" href="/favicon/blog-favicon.png"/>
      <meta name="theme-color" content="#000"/>
      <link rel="alternate" type="application/rss+xml" href="/feed.xml"/>
    </head>
    <body className={inter.className}>
    <Header/>
    <div className="min-h-screen">{children}</div>
    </body>
    </html>
  )
}
