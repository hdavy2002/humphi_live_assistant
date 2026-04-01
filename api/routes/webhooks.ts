import { Hono } from "hono";
import { Webhook } from "svix";
import { inngest } from "../lib/inngest.js";

export const clerkWebhooks = new Hono();

clerkWebhooks.post("/clerk", async (c) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("CLERK_WEBHOOK_SECRET is not set");
  }

  // Get the headers
  const svix_id = c.req.header("svix-id");
  const svix_timestamp = c.req.header("svix-timestamp");
  const svix_signature = c.req.header("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return c.json({ error: "Missing svix headers" }, 400);
  }

  // Get the body
  const payload = await c.req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any;

  // Attempt to verify the incoming webhook
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err: any) {
    console.error("Webhook verification failed:", err.message);
    return c.json({ error: "Verification failed" }, 400);
  }

  // Process the event
  const { type, data } = evt;

  if (type === "user.created") {
    // Send event to Inngest for background processing
    await inngest.send({
      name: "clerk/user.created",
      data: data,
    });
    
    console.log(`Dispatched user.created event for ${data.id} to Inngest`);
  }

  return c.json({ success: true });
});
