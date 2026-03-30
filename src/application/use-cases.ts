import { ProfileRepository, TransactionRepository } from "../domain/repositories";
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
