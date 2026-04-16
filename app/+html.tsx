import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML template for web builds.
 * Includes PWA manifest, meta tags, service worker registration,
 * and Apple-specific PWA configuration.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>Tenis-Lab</title>
        <meta
          name="description"
          content="Gestión de clases, análisis biomecánico de video y seguimiento de alumnos para profesores de tenis."
        />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme color for browser chrome */}
        <meta name="theme-color" content="#1E293B" />

        {/* Apple PWA support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Tenis-Lab" />
        <link rel="apple-touch-icon" href="/pwa-icon-192.png" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('[PWA] Service Worker registered:', reg.scope); })
                    .catch(function(err) { console.warn('[PWA] Service Worker registration failed:', err); });
                });
              }
            `,
          }}
        />

        {/* Reset default browser styles for React Native Web */}
        <ScrollViewStyleReset />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body { height: 100%; }
              body { overflow: hidden; }
              #root { display: flex; height: 100%; flex: 1; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
