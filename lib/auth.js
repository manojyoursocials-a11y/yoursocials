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
        const db   = getDb();
        // Allow login with email OR phone number
        const user = await db.getUserByEmailOrPhone(credentials.email);
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.password || '');
        if (!ok) return null;
        // ── CRITICAL: store ONLY small fields in the token ──
        // Do NOT put image (base64) here — it bloats the JWT cookie
        return {
          id:        user.id,
          email:     user.email,
          name:      user.name,
          role:      user.role,
          job_title: user.job_title || '',
          coins:     user.coins    || 0,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages:   { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    // jwt: store only essential small fields — no image, no large fields
    async jwt({ token, user }) {
      if (user) {
        token.id        = user.id;
        token.role      = user.role;
        token.email     = user.email;
        token.name      = user.name;
        token.job_title = user.job_title || '';
        token.coins     = user.coins     || 0;
      }
      return token;
    },
    // session: build from token fields only — never from DB on every request
    // This keeps the cookie small (no base64 image stored in cookie)
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id        = token.id;
        session.user.role      = token.role;
        session.user.email     = token.email;
        session.user.name      = token.name;
        session.user.job_title = token.job_title || '';
        session.user.coins     = token.coins     || 0;
        // image is NOT stored in JWT — fetched per-page via /api/members
        // This keeps the session cookie under Vercel's 8KB header limit
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
