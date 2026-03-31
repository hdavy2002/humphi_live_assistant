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
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === "succeeded" && paymentIntent.metadata) {
      const userId = paymentIntent.metadata.userId;
      const amount = parseFloat(paymentIntent.metadata.amount);

      // Check if this payment was already processed
      const existingTx = await this.transactionRepo.getByStripeSessionId(paymentIntentId);
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
        stripeSessionId: paymentIntentId, // Using the PI ID as the session ID mapping
      });

      return { success: true, newBalance };
    }

    throw new Error(`Payment status: ${paymentIntent.status}`);
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
