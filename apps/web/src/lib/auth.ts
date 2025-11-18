/**
 * NextAuth configuration for Google OAuth
 */

import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  
  pages: {
    signIn: '/login',
    error: '/login',
  },
  
  callbacks: {
    async signIn({ user, account, profile }) {
      // Create user in backend on first sign in
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const response = await fetch(`${API_URL}/auth/oauth-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
            provider: account?.provider,
            provider_id: account?.providerAccountId,
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to create user in backend');
          return false;
        }
        
        const data = await response.json();
        // Store user_id for API calls
        user.id = data.user_id;
        
        return true;
      } catch (error) {
        console.error('Sign in error:', error);
        return false;
      }
    },
    
    async session({ session, token }) {
      // Add user_id to session for API calls
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
    
    async jwt({ token, user, account }) {
      // Store provider info
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  secret: process.env.NEXTAUTH_SECRET,
};

