import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { LogEntry } from '../types';

interface LogContextType {
  logs: LogEntry[];
  addLog: (type: LogEntry['type'], message: string, details?: any) => void;
  clearLogs: () => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export const LogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('humphi_session_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
      }
    } catch (e) {
      console.error('Failed to load logs from localStorage', e);
    }
    return [];
  });

  const addLog = useCallback((type: LogEntry['type'], message: string, details?: any) => {
    setLogs((prev) => {
      const newLog: LogEntry = {
        id: Math.random().toString(36).slice(2),
        timestamp: new Date(),
        type,
        message,
        details,
      };
      
      // Keep only last 200 logs to prevent memory/UI issues with diagnostic data
      const updated = [...prev, newLog].slice(-200);
      
      // Only persist non-system/non-diagnostic logs to localStorage to prevent size errors
      // or simply don't persist details for non-error logs.
      const persistableLogs = updated.map(l => {
         if (l.type === 'error' || l.type === 'warn') return l;
         return { ...l, details: undefined }; // Strip large metadata for stability
      });
      
      try {
        localStorage.setItem('humphi_session_logs', JSON.stringify(persistableLogs));
      } catch (e) {
        // If localStorage is full, clear it and try one more time or just fail silently
        console.warn('Log cache full, could not persist.');
      }
      
      return updated;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <LogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LogContext.Provider>
  );
};

export const useLogs = () => {
  const context = useContext(LogContext);
  if (context === undefined) {
    throw new Error('useLogs must be used within a LogProvider');
  }
  return context;
};
