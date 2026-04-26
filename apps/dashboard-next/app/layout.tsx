import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Overtraining Prevention',
  description: '과훈련 방지 스마트헬스케어 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
