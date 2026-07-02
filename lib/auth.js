import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getDb } from './db';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user }) {
      try {
        getDb().upsertUser({ id: user.id || user.email, email: user.email, name: user.name, image: user.image });
      } catch (e) { console.error('signIn error:', e.message); }
      return true;
    },
    async session({ session }) {
      if (session?.user?.email) {
        try {
          const row = getDb().getUserByEmail(session.user.email);
          if (row) session.user = { ...session.user, ...row };
        } catch (e) { console.error('session error:', e.message); }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.email = user.email;
      return token;
    },
  },
};

export default NextAuth(authOptions);
