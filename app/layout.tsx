import type {Metadata} from 'next';
import './globals.css'; // Global styles
import { AuthProvider } from '@/hooks/use-auth';

export const metadata: Metadata = {
  title: 'Condomínio Digital',
  description: 'Gestão inteligente para o seu condomínio',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning className="bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
