import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { sql } from '@vercel/postgres';

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
      // Upsert user into our own users table
      await sql`
        INSERT INTO users (id, email, name, image)
        VALUES (${user.id ?? user.email}, ${user.email}, ${user.name}, ${user.image})
        ON CONFLICT (email) DO UPDATE
          SET name  = EXCLUDED.name,
              image = EXCLUDED.image,
              last_active = NOW()
      `;
      return true;
    },

    async session({ session, token }) {
      if (session?.user?.email) {
        const { rows } = await sql`
          SELECT id, email, name, image, role, job_title, coins, streak
          FROM users WHERE email = ${session.user.email}
        `;
        if (rows[0]) session.user = { ...session.user, ...rows[0] };
      }
      return session;
    },

    async jwt({ token, user, account }) {
      if (user) token.email = user.email;
      return token;
    },
  },
};

export default NextAuth(authOptions);
