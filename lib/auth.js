import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getDb } from './db';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const db   = getDb();
        const user = await db.getUserByEmail(credentials.email);
        if (!user) return null;
        const ok = await bcrypt.compare(credentials.password, user.password || '');
        if (!ok) return null;
        const { password, ...safe } = user;
        return safe;
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = user.role; token.email = user.email; }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        try {
          const db   = getDb();
          const user = await db.getUserById(token.id);
          if (user) { const { password, ...safe } = user; session.user = { ...session.user, ...safe }; }
        } catch (e) { console.error('session error:', e.message); }
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
