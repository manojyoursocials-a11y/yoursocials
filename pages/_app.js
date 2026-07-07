import { useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  // Auto-run setup on first load (idempotent — safe to run every time)
  useEffect(() => {
    fetch('/api/setup', { method: 'POST' }).catch(() => {});
  }, []);
  return (
    <SessionProvider session={session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/>
        <meta name="theme-color" content="#09090F"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <meta name="apple-mobile-web-app-title" content="Your Socials"/>

        {/* Favicon — Your Socials logo */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico"/>
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png"/>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"/>
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png"/>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>
        <link rel="shortcut icon" href="/favicon.ico"/>

        <title>Your Socials OS</title>
      </Head>
      <Component {...pageProps}/>
    </SessionProvider>
  );
}
