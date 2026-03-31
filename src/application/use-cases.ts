import { ProfileRepository, TransactionRepository } from "../domain/repositories.js";
import Stripe from "stripe";

export class WalletUseCase {
  constructor(
    private profileRepo: ProfileRepository,
    private transactionRepo: TransactionRepository,
    private stripe: Stripe
  ) {}

  async createCheckoutSession(amount: number, userId: string, appUrl: string) {
    if (!amount || amount < 2) {
      throw new Error("Minimum top-up is 2 USD");
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Wallet Top-up",
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${appUrl}/wallet?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/wallet`,
      metadata: {
        userId,
        amount: amount.toString(),
      },
    });

    return session.id;
  }

  async createPaymentIntent(amount: number, userId: string) {
    if (!amount || amount < 2) {
      throw new Error("Minimum top-up is 2 USD");
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      metadata: {
        userId,
        amount: amount.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id
    };
  }

  async verifyPaymentIntent(paymentIntentId: string) {
    if (!paymentIntentId) throw new Error("Missing payment intent ID");

    let paymentIntent;
    try {
      paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (err: any) {
      console.error("Stripe Retrieval Error:", err);
      throw new Error(`Failed to retrieve payment info: ${err.message}`);
    }
    
    if (paymentIntent.status !== "succeeded") {
      throw new Error(`Payment is not yet successful. Status: ${paymentIntent.status}`);
    }

    if (!paymentIntent.metadata || !paymentIntent.metadata.userId || !paymentIntent.metadata.amount) {
      console.error("Missing Metadata in PaymentIntent:", paymentIntent.id);
      throw new Error("Invalid payment metadata. Please contact support.");
    }

    const userId = paymentIntent.metadata.userId;
    const amount = parseFloat(paymentIntent.metadata.amount);

    // Check if this payment was already processed
    let existingTx;
    try {
      existingTx = await this.transactionRepo.getByStripeSessionId(paymentIntentId);
    } catch (err: any) {
      console.error("Database Query Error (getByStripeSessionId):", err);
      // If the column is missing, this will fail. We want a clear error.
      if (err.message?.includes("column") && err.message?.includes("stripe_session_id")) {
        throw new Error("Database schema out of date. Please run the SQL migration for 'stripe_session_id'.");
      }
      throw new Error(`Database error during verification: ${err.message}`);
    }

    if (existingTx) {
      return { success: true, alreadyProcessed: true };
    }

    try {
      const profile = await this.profileRepo.getById(userId);
      if (!profile) throw new Error("User profile not found. Are you signed in correctly?");

      const newBalance = profile.walletBalance + amount;
      
      // Atomic Update (ideally this should be in a transaction, but we'll stick to sequential for now as per current pattern)
      await this.profileRepo.updateBalance(userId, newBalance);

      await this.transactionRepo.create({
        userId,
        amount,
        type: "topup",
        status: "completed",
        stripeSessionId: paymentIntentId,
        description: `Stripe Top-up: ${paymentIntentId}`,
      });

      return { success: true, newBalance };
    } catch (err: any) {
      console.error("Balance Update Error:", err);
      throw new Error(`Failed to update balance: ${err.message}`);
    }
  }

  async verifySession(sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === "paid" && session.metadata) {
      const userId = session.metadata.userId;
      const amount = parseFloat(session.metadata.amount);

      const existingTx = await this.transactionRepo.getByStripeSessionId(sessionId);
      if (existingTx) {
        return { success: true, alreadyProcessed: true };
      }

      const profile = await this.profileRepo.getById(userId);
      if (!profile) throw new Error("Profile not found");

      const newBalance = profile.walletBalance + amount;
      await this.profileRepo.updateBalance(userId, newBalance);

      await this.transactionRepo.create({
        userId,
        amount,
        type: "topup",
        status: "completed",
        stripeSessionId: sessionId,
      });

      return { success: true, newBalance };
    }

    throw new Error("Payment not completed");
  }
}
