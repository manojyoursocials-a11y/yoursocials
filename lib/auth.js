import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getDb } from './db';

export const authOptions = {
  providers: [
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

          // 1. Try email login (always works)
          try { user = await db.getUserByEmail(q); } catch(e) {}

          // 2. Try phone login (safe catch if column missing)
          if (!user) {
            try { user = await db.getUserByPhone(q); } catch(e) {}
          }

          // 3. Try combined query
          if (!user) {
            try { user = await db.getUserByEmailOrPhone(q); } catch(e) {}
          }

          if (!user) return null;

          const ok = await bcrypt.compare(credentials.password, user.password || '');
          if (!ok) return null;

          // Return ONLY tiny fields — never base64 image
          return {
            id:        user.id,
            email:     user.email,
            name:      user.name       || '',
            role:      user.role       || 'member',
            job_title: user.job_title  || '',
            coins:     user.coins      || 0,
          };
        } catch(e) {
          console.error('Auth authorize error:', e.message);
          return null;
        }
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,
  pages:  { signIn: '/login', error: '/login' }, // redirect errors back to login page not /api/auth/error

  session: {
    strategy:  'jwt',
    maxAge:    30 * 24 * 60 * 60, // 30 days
  },

  // Cookie settings — fixes Safari ITP / iPhone login issues
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',   // 'lax' works on iPhone Safari, 'strict' can block it
        path:     '/',
        secure:   process.env.NODE_ENV === 'production',
      },
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id        = user.id;
        token.role      = user.role      || 'member';
        token.name      = user.name      || '';
        token.job_title = user.job_title || '';
        token.coins     = user.coins     || 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id        = token.id;
        session.user.role      = token.role      || 'member';
        session.user.name      = token.name      || '';
        session.user.email     = token.email     || '';
        session.user.job_title = token.job_title || '';
        session.user.coins     = token.coins     || 0;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
