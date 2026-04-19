import type { Metadata } from 'next';
import 'bootstrap/dist/css/bootstrap.min.css';
import './globals.css';
import MockProvider from '@/components/layout/MockProvider';

export const metadata: Metadata = {
  title: 'Photograph Platform',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <MockProvider>
          {children}
        </MockProvider>
      </body>
    </html>
  );
}
