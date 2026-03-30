
export async function sendEmail(userId: string, message: string): Promise<void> {
  console.log(`Sending email to user ${userId}: ${message}`);
}

export async function updateBalance(userId: string, amount: number): Promise<void> {
  // In a real Temporal activity, you'd initialize the repository here or use dependency injection
  const { DrizzleProfileRepository } = await import("../../infrastructure/repositories");
  const profileRepo = new DrizzleProfileRepository();
  const profile = await profileRepo.getById(userId);
  if (!profile) throw new Error("Profile not found");
  await profileRepo.updateBalance(userId, profile.walletBalance + amount);
}
