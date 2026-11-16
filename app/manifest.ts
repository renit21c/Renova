import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Renova — Personal Workspace',
    short_name: 'Renova',
    description: 'Ruang pribadi untuk rencana, catatan, dan keuanganmu.',
    lang: 'id',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fbf7fa',
    theme_color: '#fbf7fa',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
