import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';

export default function ChatPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  return (
    <Layout noPadding>
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: 'calc(100dvh - 60px)', overflow: 'hidden',
      }}>
        {/* Thin header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="https://www.gstatic.com/images/branding/product/1x/chat_2020q4_48dp.png"
              width={22} height={22} alt="Google Chat"
              style={{ borderRadius: 4 }}
              onError={e => e.target.style.display='none'}
            />
            <span style={{ fontWeight: 800, fontSize: '.9rem' }}>Google Chat</span>
            <span style={{
              fontSize: '.65rem', background: 'rgba(0,172,71,.15)',
              color: '#00AC47', padding: '2px 8px', borderRadius: 20, fontWeight: 700,
            }}>Connected</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="https://chat.google.com" target="_blank" rel="noopener noreferrer"
              style={{
                padding: '5px 12px', background: 'var(--surface3)',
                border: '1px solid var(--border2)', borderRadius: 8,
                color: 'var(--muted2)', fontSize: '.75rem', fontWeight: 600,
                textDecoration: 'none', fontFamily: 'Inter,sans-serif',
              }}>↗ Pop out</a>
          </div>
        </div>

        {/* iframe — full height */}
        <div style={{ flex: 1, position: 'relative', background: '#1a1a2e' }}>
          {!loaded && !error && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 16, color: 'var(--muted2)',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'linear-gradient(135deg,#00AC47,#00832D)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.8rem',
              }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: '.95rem' }}>Loading Google Chat…</div>
              <div style={{ fontSize: '.78rem', opacity: .6 }}>Make sure you are signed in to Google</div>
            </div>
          )}

          {error && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 20, padding: 32, textAlign: 'center',
            }}>
              <div style={{ fontSize: '3rem' }}>🔒</div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>Google Chat cannot be embedded</div>
              <div style={{
                fontSize: '.85rem', color: 'var(--muted2)', lineHeight: 1.7,
                maxWidth: 460,
              }}>
                Google blocks embedding chat.google.com in iframes for security. The best solution is to open Google Chat as a standalone app alongside Your Socials OS.
              </div>

              <div style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '24px 28px', maxWidth: 480, width: '100%',
              }}>
                <div style={{ fontWeight: 800, fontSize: '.92rem', marginBottom: 16 }}>
                  ✅ How your team should use it
                </div>
                {[
                  ['📌', 'Pin Google Chat to taskbar', 'Open chat.google.com → click Install/Add to taskbar in Chrome — it becomes a separate app window sitting next to Your Socials'],
                  ['📱', 'Install on phone', 'Download Google Chat from App Store / Play Store — get notifications on mobile'],
                  ['🔔', 'Notifications already connected', 'Your Socials already posts task updates to your Google Chat spaces (Scale Up, Fattoush, etc.) via the Google Chat bot'],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{
                    display: 'flex', gap: 14, marginBottom: 14,
                    paddingBottom: 14, borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 3 }}>{title}</div>
                      <div style={{ fontSize: '.78rem', color: 'var(--muted2)', lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                  <a href="https://chat.google.com" target="_blank" rel="noopener noreferrer"
                    style={{
                      flex: 1, padding: '11px', background: 'linear-gradient(135deg,#00AC47,#00832D)',
                      border: 'none', borderRadius: 10, color: '#fff', fontSize: '.88rem',
                      fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                      textAlign: 'center', textDecoration: 'none', display: 'block',
                    }}>
                    💬 Open Google Chat
                  </a>
                </div>
              </div>

              {/* Install Google Chat as PWA guide */}
              <div style={{
                background: 'rgba(0,172,71,.06)', border: '1px solid rgba(0,172,71,.2)',
                borderRadius: 12, padding: '16px 20px', maxWidth: 480, width: '100%',
                fontSize: '.8rem', color: 'var(--muted2)', lineHeight: 1.7,
              }}>
                <div style={{ fontWeight: 700, color: '#00AC47', marginBottom: 6 }}>
                  💡 Install Google Chat as a desktop app
                </div>
                In Chrome: open chat.google.com → click the <strong>⊕ Install</strong> icon in the address bar → Install.
                It opens in its own window with no browser tabs — just like a native app, sitting alongside Your Socials OS.
              </div>
            </div>
          )}

          <iframe
            src="https://chat.google.com"
            style={{
              width: '100%', height: '100%', border: 'none',
              display: loaded && !error ? 'block' : 'none',
            }}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            allow="camera; microphone; notifications; clipboard-read; clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
            title="Google Chat"
          />
        </div>
      </div>
    </Layout>
  );
}
