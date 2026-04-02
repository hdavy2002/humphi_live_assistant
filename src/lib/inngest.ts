import { Inngest } from "inngest";

// Dedicated inngest client for Humphi Live Assistant
// This client is used to dispatch business-critical background events 
// like session saving and billing to avoid serverless timeouts.
export const inngest = new Inngest({ id: "humphi-live-assistant" });
