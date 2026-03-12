import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '澳洲房产投资计算器',
  description: '快速估算贷款还款、租金收益、现金流与前期成本，适用于澳洲房产投资场景。'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
