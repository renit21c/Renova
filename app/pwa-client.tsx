'use client';

import { useEffect } from 'react';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaClient() {
  useEffect(() => {
    let prompt: InstallEvent | null = null;
    let busy = false;
    const notice = (message: string) => window.dispatchEvent(new CustomEvent('renova:notice', { detail: { message, duration: 7000 } }));
    const beforeInstall = (event: Event) => { event.preventDefault(); prompt = event as InstallEvent; };
    const installed = () => { prompt = null; notice('Renova sudah ditambahkan ke perangkatmu.'); };
    const install = async () => {
      if (busy) return;
      if (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone) {
        notice('Kamu sudah menggunakan Renova sebagai aplikasi.'); return;
      }
      if (!prompt) {
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        notice(ios ? 'Di Safari: ketuk Bagikan, lalu Tambahkan ke Layar Utama.' : 'Buka menu browser, lalu pilih Install Renova atau Tambahkan ke layar utama.'); return;
      }
      busy = true;
      try {
        await prompt.prompt(); await prompt.userChoice; prompt = null;
      } catch { notice('Instalasi belum tersedia. Coba lewat menu browser.'); }
      finally { busy = false; }
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('renova:install', install);
    if ('serviceWorker' in navigator && (process.env.NODE_ENV === 'production' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(error => {
        console.warn('Renova PWA registration failed:', error);
      });
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('renova:install', install);
    };
  }, []);
  return null;
}
