import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AssistantWidget } from '@/src/components/AssistantWidget';
import { CartProvider } from '@/src/order/cartContext';

export const metadata: Metadata = {
  title: 'ROCK UC FOODS | Taste the Luxury',
  description: 'Premium Nigerian dishes, crafted with tradition, served with class.',
  openGraph: {
    title: 'ROCK UC FOODS | Taste the Luxury',
    description: 'Premium Nigerian dishes, crafted with tradition, served with class.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ROCK UC FOODS | Taste the Luxury',
    description: 'Premium Nigerian dishes, crafted with tradition, served with class.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en-NG" className="bg-[#0B0A09] text-[#F7EFD9]">
      <body suppressHydrationWarning className="bg-[#0B0A09] text-[#F7EFD9] min-h-screen antialiased">
        <CartProvider>
          {children}
          <AssistantWidget />
        </CartProvider>
      </body>
    </html>
  );
}
