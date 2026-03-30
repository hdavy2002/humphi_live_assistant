export interface Profile {
  id: string;
  email: string | null;
  walletBalance: number;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  stripeSessionId: string | null;
  createdAt: Date;
}
