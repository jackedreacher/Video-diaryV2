import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { logger } from '../utils/logger';

export const DebugPanel = () => {
  const [logs, setLogs] = useState<string>('');

  const loadLogs = async () => {
    const logContent = await logger.getLogs();
    setLogs(logContent);
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 2000); // Refresh logs every 2 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug Logs</Text>
        <TouchableOpacity 
          style={styles.clearButton}
          onPress={async () => {
            await logger.clearLogs();
            setLogs('');
          }}
        >
          <Text style={styles.clearButtonText}>Clear Logs</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.logContainer}>
        <Text style={styles.logText}>{logs}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#444',
    padding: 8,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#fff',
  },
  logContainer: {
    flex: 1,
    padding: 16,
  },
  logText: {
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
}); 