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
        const db = getDb();
        const id = user.id || user.email;
        db.prepare(`
          INSERT INTO users (id, email, name, image)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            name  = excluded.name,
            image = excluded.image
        `).run(id, user.email, user.name || '', user.image || '');
      } catch (e) {
        console.error('signIn DB error:', e.message);
      }
      return true;
    },

    async session({ session }) {
      if (session?.user?.email) {
        try {
          const db = getDb();
          const row = db.prepare(
            'SELECT id, email, name, image, role, job_title, coins, streak FROM users WHERE email = ?'
          ).get(session.user.email);
          if (row) session.user = { ...session.user, ...row };
        } catch (e) {
          console.error('session DB error:', e.message);
        }
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
