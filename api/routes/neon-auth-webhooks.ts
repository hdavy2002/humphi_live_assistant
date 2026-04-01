import { Hono } from "hono";
import crypto from "node:crypto";
import { inngest } from "../lib/inngest.js";

export const neonAuthWebhooks = new Hono();

/**
 * Verify Ed25519 Detached JWS signature from Neon Auth
 * @see https://neon.tech/docs/guides/auth-webhooks
 */
async function verifyNeonSignature(rawBody: string, headers: Record<string, string | undefined>) {
  const signature = headers["x-neon-signature"];
  const kid = headers["x-neon-signature-kid"];
  const timestamp = headers["x-neon-timestamp"];
  const authUrl = process.env.NEON_AUTH_URL;

  if (!signature || !kid || !timestamp || !authUrl) {
    throw new Error("Missing required headers or NEON_AUTH_URL");
  }

  // 1. Fetch JWKS from Neon Auth
  // We should ideally cache this in production
  const jwksRes = await fetch(`${authUrl}/.well-known/jwks.json`);
  if (!jwksRes.ok) throw new Error("Failed to fetch JWKS from Neon Auth");
  
  const jwks = await jwksRes.json();
  const jwk = jwks.keys.find((k: any) => k.kid === kid);
  
  if (!jwk) throw new Error(`Key ${kid} not found in JWKS`);

  // 2. Import the Ed25519 public key
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });

  // 3. Parse detached JWS (header..signature)
  const parts = signature.split(".");
  if (parts.length !== 3 || parts[1] !== "") {
    throw new Error("Invalid detached JWS format");
  }
  const [headerB64, , signatureB64] = parts;

  // 4. Reconstruct signing input
  // Payload is timestamp + "." + base64url(rawBody)
  const payloadB64 = Buffer.from(rawBody, "utf8").toString("base64url");
  const signaturePayload = `${timestamp}.${payloadB64}`;
  const signaturePayloadB64 = Buffer.from(signaturePayload, "utf8").toString("base64url");
  const signingInput = `${headerB64}.${signaturePayloadB64}`;

  // 5. Verify Ed25519 signature
  const isValid = crypto.verify(
    null,
    Buffer.from(signingInput),
    publicKey,
    Buffer.from(signatureB64, "base64url")
  );

  if (!isValid) throw new Error("Invalid webhook signature");

  return JSON.parse(rawBody);
}

neonAuthWebhooks.post("/neon", async (c) => {
  try {
    const rawBody = await c.req.text();
    const headers = {
      "x-neon-signature": c.req.header("x-neon-signature"),
      "x-neon-signature-kid": c.req.header("x-neon-signature-kid"),
      "x-neon-timestamp": c.req.header("x-neon-timestamp"),
    };

    const payload = await verifyNeonSignature(rawBody, headers);
    console.log("Neon Webhook Verified:", payload.type);

    // Process events
    if (payload.type === "user.created") {
      // Dispatch to Inngest for provisioning
      // Note: mapping Neon user structure to our event data
      await inngest.send({
        name: "neon/user.created",
        data: {
          id: payload.data.id,
          email: payload.data.email,
          // Add other fields as needed for provisioning
        },
      });
      console.log(`Dispatched user.created event for ${payload.data.id} to Inngest`);
    }

    return c.json({ success: true });
  } catch (err: any) {
    console.error("Neon Webhook Error:", err.message);
    return c.json({ error: err.message }, 400);
  }
});
