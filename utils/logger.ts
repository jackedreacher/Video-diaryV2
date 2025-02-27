import * as FileSystem from 'expo-file-system';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class Logger {
  private static instance: Logger;
  private logFile: string;
  
  private constructor() {
    this.logFile = `${FileSystem.documentDirectory}app.log`;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private async writeLog(level: LogLevel, context: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context,
      message,
      data: data ? JSON.stringify(data) : undefined
    };

    const logString = `[${timestamp}] ${level} [${context}] ${message}${data ? '\nData: ' + JSON.stringify(data, null, 2) : ''}\n`;
    
    try {
      await FileSystem.writeAsStringAsync(this.logFile, logString, { append: true });
      // Also log to console for development
      console.log(logString);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  debug(context: string, message: string, data?: any) {
    this.writeLog('DEBUG', context, message, data);
  }

  info(context: string, message: string, data?: any) {
    this.writeLog('INFO', context, message, data);
  }

  warn(context: string, message: string, data?: any) {
    this.writeLog('WARN', context, message, data);
  }

  error(context: string, message: string, data?: any) {
    this.writeLog('ERROR', context, message, data);
  }

  async getLogs(): Promise<string> {
    try {
      return await FileSystem.readAsStringAsync(this.logFile);
    } catch {
      return '';
    }
  }

  async clearLogs() {
    try {
      await FileSystem.deleteAsync(this.logFile, { idempotent: true });
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }
}

export const logger = Logger.getInstance(); 