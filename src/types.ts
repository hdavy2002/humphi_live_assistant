export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'error' | 'warning' | 'sent' | 'received';
  message: string;
  details?: any;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export interface Profile {
  id: string;
  email: string;
  wallet_balance: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'topup' | 'usage';
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  stripe_session_id?: string;
}
