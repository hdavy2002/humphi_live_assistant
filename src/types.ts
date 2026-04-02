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
  type: 'topup' | 'usage' | 'TOP_UP' | 'USAGE';
  status: 'pending' | 'completed' | 'failed' | 'PENDING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  stripe_session_id?: string;
}

export interface Recording {
  id: string;
  user_id: string;
  title: string;
  timestamp: string;
  duration: string;
  thumbnail_url?: string;
  sync_status: 'local' | 'syncing' | 'cloud';
  bunny_stream_id?: string;
  size_bytes?: number;
}
