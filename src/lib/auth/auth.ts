import "server-only";

import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/db/prisma";
import { getAuthenticationEnvironment } from "@/lib/env/server";

const TWELVE_HOURS_IN_SECONDS = 60 * 60 * 12;

export const auth = betterAuth({
  appName: "StockFlow",
  baseURL: process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000",
  secret: getAuthenticationEnvironment().AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  user: {
    additionalFields: {
      role: {
        type: ["ADMIN", "MANAGER", "STAFF"],
        required: true,
        defaultValue: "STAFF",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  session: {
    expiresIn: TWELVE_HOURS_IN_SECONDS,
    updateAge: 60 * 60,
    freshAge: 60 * 15,
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          });

          if (!user?.isActive) {
            throw new APIError("UNAUTHORIZED", { message: "Invalid email or password" });
          }

          return { data: session };
        },
      },
    },
  },
  advanced: {
    cookiePrefix: "stockflow",
    database: {
      generateId: "uuid",
      joins: true,
    },
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
  plugins: [nextCookies()],
});

export type StockFlowSession = typeof auth.$Infer.Session;
