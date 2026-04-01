export interface WalletProfile {
  id: string;
  userId: string;
  email: string;
  balance: number;
  currency: string;
  status: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  amount: number;
  type: string;
  description: string;
  metadata: any;
  createdAt: string;
}

export async function getWalletProfile(userId: string): Promise<WalletProfile> {
  const res = await fetch(`/api/wallet/profile?userId=${userId}`);
  if (!res.ok) throw new Error("Failed to fetch wallet profile");
  return res.json();
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const res = await fetch(`/api/wallet/transactions?userId=${userId}`);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

export async function seedWallet(userId: string, email: string): Promise<WalletProfile> {
  const res = await fetch("/api/wallet/seed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, email }),
  });
  if (!res.ok) throw new Error("Failed to seed wallet");
  return res.json();
}
