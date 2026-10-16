import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// Extend Express session type
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
    }
  }
}

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done: (error: Error | null, user?: Express.User | false) => void
    ) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email returned from Google'));
        }

        const user = await prisma.user.upsert({
          where: { googleId: profile.id },
          update: {
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value ?? null,
            email, // Update in case user changed Google email
          },
          create: {
            googleId: profile.id,
            email,
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value ?? null,
          },
        });

        logger.info('User authenticated via Google', { userId: user.id });
        return done(null, {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        });
      } catch (err) {
        logger.error('Google OAuth error', { error: (err as Error).message });
        return done(err as Error);
      }
    }
  )
);

// Serialize: store just the user ID in session
passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

// Deserialize: load user from database by ID
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    if (!user) return done(null, false);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export { passport };
