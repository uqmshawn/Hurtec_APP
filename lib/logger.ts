import * as SecureStore from 'expo-secure-store';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  at: string; // ISO
  level: LogLevel;
  tag: string;
  message: string;
  extra?: any;
}

const KEY = 'dashboard.logs';
const MAX = 500;

export async function addLog(level: LogLevel, tag: string, message: string, extra?: any) {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const arr: LogEntry[] = raw ? JSON.parse(raw) : [];
    arr.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), level, tag, message, extra });
    while (arr.length > MAX) arr.shift();
    await SecureStore.setItemAsync(KEY, JSON.stringify(arr));
  } catch {}
}

export async function getLogs(): Promise<LogEntry[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearLogs(): Promise<void> {
  try { await SecureStore.deleteItemAsync(KEY); } catch {}
}

export async function exportLogsString(): Promise<string> {
  const logs = await getLogs();
  return JSON.stringify({ exportedAt: new Date().toISOString(), count: logs.length, logs }, null, 2);
}