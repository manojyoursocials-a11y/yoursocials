import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/>
        <meta name="theme-color" content="#09090F"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <title>Your Socials OS</title>
      </Head>
      <Component {...pageProps}/>
    </SessionProvider>
  );
}
