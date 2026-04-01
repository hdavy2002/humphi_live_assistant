import { clerkMiddleware, getAuth } from "@clerk/hono";
import { Context, Next } from "hono";

export const authMiddleware = clerkMiddleware();

export const requireAuth = async (c: Context, next: Next) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
};

export { getAuth };
