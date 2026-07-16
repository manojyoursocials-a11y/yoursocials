import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { getDb } from './db';

export const authOptions = {
  providers: [
    // ── Google OAuth (for Chat integration) ──────────────
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/chat.spaces',
            'https://www.googleapis.com/auth/chat.spaces.readonly',
            'https://www.googleapis.com/auth/chat.messages',
            'https://www.googleapis.com/auth/chat.messages.readonly',
            'https://www.googleapis.com/auth/chat.memberships.readonly',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent select_account',
        },
      },
    }),

    // ── Email/Phone + Password (existing login) ───────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email or Phone', type: 'text' },
        password: { label: 'Password',       type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const db = getDb();
          const q  = (credentials.email || '').trim().toLowerCase();
          let user = null;
          try { user = await db.getUserByEmail(q); } catch(e) {}
          if (!user) { try { user = await db.getUserByPhone(q); } catch(e) {} }
          if (!user) { try { user = await db.getUserByEmailOrPhone(q); } catch(e) {} }
          if (!user) return null;
          const ok = await bcrypt.compare(credentials.password, user.password || '');
          if (!ok) return null;
          return {
            id:        user.id,
            email:     user.email,
            name:      user.name      || '',
            role:      user.role      || 'member',
            job_title: user.job_title || '',
            coins:     user.coins     || 0,
          };
        } catch(e) {
          console.error('Auth error:', e.message);
          return null;
        }
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,
  pages:  { signIn: '/login', error: '/login' },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },

  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id        = user.id;
        token.role      = user.role      || 'member';
        token.name      = user.name      || '';
        token.job_title = user.job_title || '';
        token.coins     = user.coins     || 0;
      }
      // Store Google access token for Chat API calls
      if (account?.provider === 'google') {
        token.googleAccessToken  = account.access_token;
        token.googleRefreshToken = account.refresh_token;
        token.googleEmail        = user?.email;
        token.role = token.role || 'member';
        token.id   = token.id   || user?.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id               = token.id;
        session.user.role             = token.role      || 'member';
        session.user.name             = token.name      || '';
        session.user.email            = token.email     || '';
        session.user.job_title        = token.job_title || '';
        session.user.coins            = token.coins     || 0;
        session.user.googleEmail      = token.googleEmail || null;
        // Pass access token to client for Google Chat API
        session.googleAccessToken     = token.googleAccessToken || null;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
