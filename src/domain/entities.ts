export interface Profile {
  id: string;
  email: string | null;
  walletBalance: number;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  walletId: string;
  amount: number;
  type: string; // 'topup' or 'usage'
  status: string; // 'completed', 'pending', 'failed'
  providerSessionId: string | null;
  metadata: any;
  createdAt: Date;
}
