import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geist = Geist({ variable: '--font-ui', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vesper — The Dragon Edition',
  description: '李小龙电影风格玻璃黑胶播放器，收录 20 首全球英文热歌、官方试听与本地音频播放。',
  metadataBase: new URL('https://vesper-obsidian-player.hajybdalstarthmanylm.chatgpt.site'),
  openGraph: {
    title: 'Vesper — The Dragon Edition',
    description: '李小龙电影风格玻璃黑胶播放器 · 20 首全球英文热歌官方试听',
    images: ['https://vesper-obsidian-player.hajybdalstarthmanylm.chatgpt.site/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vesper — The Dragon Edition',
    description: '李小龙电影风格玻璃黑胶播放器 · 20 首全球英文热歌官方试听',
    images: ['https://vesper-obsidian-player.hajybdalstarthmanylm.chatgpt.site/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" className="dark"><body className={`${geist.variable} ${mono.variable}`}>{children}</body></html>;
}
