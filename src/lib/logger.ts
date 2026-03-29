import { supabase } from './supabaseClient';

export type LogLevel = 'info' | 'warn' | 'error' | 'critical';

interface LogOptions {
  storeId?: string;
  userId?: string;
  action: string;
  metadata?: any;
}

export const logger = {
  async log(level: LogLevel, message: string, options: LogOptions) {
    // 1. Console Fallback (still useful for local debugging)
    const consoleMethod = level === 'critical' || level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${level.toUpperCase()}] ${options.action}: ${message}`, options.metadata || '');

    // 2. Persistent Supabase Log (Audit Logs Table)
    try {
      await fetch('/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: options.storeId,
          action: options.action,
          severity: level,
          metadata: { ...options.metadata, message }
        })
      });
    } catch (e) {
      console.error('Logging Exception:', e);
    }
  },

  async info(message: string, options: LogOptions) {
    return this.log('info', message, options);
  },

  async warn(message: string, options: LogOptions) {
    return this.log('warn', message, options);
  },

  async error(message: string, options: LogOptions) {
    return this.log('error', message, options);
  },

  async critical(message: string, options: LogOptions) {
    return this.log('critical', message, options);
  }
};
