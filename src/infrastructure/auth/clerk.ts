import { clerkMiddleware, getAuth } from "@clerk/hono";
import { Context, Next } from "hono";

export const authMiddleware = clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
  apiUrl: process.env.CLERK_API_URL,
  jwtKey: process.env.CLERK_JWT_KEY,
});

export const requireAuth = async (c: Context, next: Next) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};

export { getAuth };
