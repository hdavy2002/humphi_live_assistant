import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";

const { sendEmail, updateBalance } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
});

export async function walletTopupWorkflow(userId: string, amount: number): Promise<string> {
  await updateBalance(userId, amount);
  await sendEmail(userId, `Your wallet has been topped up with ${amount} USD`);
  return "Success";
}
