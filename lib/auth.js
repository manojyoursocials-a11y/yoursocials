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
          let user = null;

          // Try email first (always works — email column always existed)
          try {
            user = await db.getUserByEmail(credentials.email);
          } catch(e) {}

          // Try phone fallback (only if email didn't match and phone column exists)
          if (!user && credentials.email && !credentials.email.includes('@')) {
            try {
              user = await db.getUserByPhone(credentials.email);
            } catch(e) {
              // phone column may not exist yet — ignore error
            }
          }

          // Also try getUserByEmailOrPhone if both above failed
          if (!user) {
            try {
              user = await db.getUserByEmailOrPhone(credentials.email);
            } catch(e) {
              // Fallback to email only if this fails
              if (!user) {
                try { user = await db.getUserByEmail(credentials.email); } catch(e2) {}
              }
            }
          }

          if (!user) return null;

          const ok = await bcrypt.compare(credentials.password, user.password || '');
          if (!ok) return null;

          // Return ONLY small fields — never include image (base64 bloats JWT cookie)
          return {
            id:        user.id,
            email:     user.email,
            name:      user.name       || '',
            role:      user.role       || 'member',
            job_title: user.job_title  || '',
            coins:     user.coins      || 0,
          };
        } catch(e) {
          console.error('Auth error:', e.message);
          return null;
        }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages:  { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id        = user.id;
        token.role      = user.role      || 'member';
        token.email     = user.email;
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
        session.user.email     = token.email;
        session.user.name      = token.name      || '';
        session.user.job_title = token.job_title || '';
        session.user.coins     = token.coins     || 0;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
