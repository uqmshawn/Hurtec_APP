import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { addLog, getLogs, clearLogs, exportLogsString } from '../lib/logger';

export default function DiagnosticsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [activeTabId, setActiveTabId] = useState<string | null>(route.params?.tabId || null);

  useEffect(() => {
    (async () => {
      setLogs(await getLogs());
      // Try to auto-fill last captured fingerprint and tab id
      try {
        const lastFP = await SecureStore.getItemAsync('diagnostics.lastCertFingerprint');
        if (lastFP && !fingerprint) setFingerprint(lastFP);
      } catch {}
      try {
        const lastTab = await SecureStore.getItemAsync('diagnostics.lastTabId');
        if (lastTab && !activeTabId) setActiveTabId(lastTab);
      } catch {}
    })();
  }, []);

  const exportLogs = async () => {
    const data = await exportLogsString();
    try {
      await Share.share({ message: data });
    } catch {
      Alert.alert('Logs Exported', 'Copy from alert body or share via telemetry endpoint.', [{ text: 'OK' }]);
      console.log('EXPORTED_LOGS', data);
    }
  };

  const applyFingerprintToTab = async () => {
    try {
      if (!activeTabId) { Alert.alert('No Tab Selected', 'Open a tab first, then open Diagnostics from header.'); return; }
      if (!fingerprint.trim()) { Alert.alert('Missing Fingerprint', 'Paste a SHA-256 fingerprint.'); return; }
      const raw = await SecureStore.getItemAsync('dashboard.tabs');
      const tabs = raw ? JSON.parse(raw) : [];
      const idx = tabs.findIndex((t: any) => t.id === activeTabId);
      if (idx === -1) { Alert.alert('Tab Not Found', 'Could not locate the current tab.'); return; }
      tabs[idx].certFingerprintSha256 = fingerprint.trim();
      await SecureStore.setItemAsync('dashboard.tabs', JSON.stringify(tabs));
      await addLog('info', 'diagnostics', `Applied fingerprint to tab ${activeTabId}`, { fingerprint });
      Alert.alert('Trusted', 'Certificate fingerprint saved to the tab.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save fingerprint.');
    }
  };

  const filtered = logs.filter(l => !filter || JSON.stringify(l).toLowerCase().includes(filter.toLowerCase()));

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0F172A', '#1E293B', '#334155']} style={styles.background}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#60A5FA" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Diagnostics</Text>
            <Text style={styles.headerSubtitle}>Logs, Certificates, Tools</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={styles.actionBtn} onPress={exportLogs}>
              <Ionicons name="download" size={18} color="#60A5FA" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={async ()=>{ await clearLogs(); setLogs([]); }}>
              <Ionicons name="trash" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ padding: 16 }}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trust current certificate</Text>
            <Text style={styles.sectionSubtitle}>Auto-filled from the last SSL error seen. You can edit before saving. Tab: {activeTabId || '—'}</Text>
            <TextInput
              style={styles.input}
              placeholder="sha256/BASE64== or 64-hex"
              placeholderTextColor="#6B7280"
              value={fingerprint}
              onChangeText={setFingerprint}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={applyFingerprintToTab}>
              <Text style={styles.primaryBtnText}>Trust certificate for this tab</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Logs</Text>
            <TextInput
              style={styles.input}
              placeholder="Filter"
              placeholderTextColor="#6B7280"
              value={filter}
              onChangeText={setFilter}
            />
            {filtered.map((l) => (
              <View key={l.id} style={styles.logRow}>
                <Text style={styles.logMeta}>{l.at} • {l.level} • {l.tag}</Text>
                <Text style={styles.logMsg}>{l.message}</Text>
              </View>
            ))}
            {filtered.length === 0 && (
              <Text style={{ color: '#94A3B8', padding: 8 }}>No logs yet.</Text>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  background: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(96,165,250,0.2)' },
  backButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(30,58,138,0.3)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: '#94A3B8', fontSize: 12 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, marginLeft: 8, backgroundColor: 'rgba(30,58,138,0.25)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)', justifyContent: 'center', alignItems: 'center' },
  section: { marginTop: 16, marginBottom: 24 },
  sectionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  sectionSubtitle: { color: '#94A3B8', fontSize: 13, marginBottom: 10 },
  input: { backgroundColor: 'rgba(30,58,138,0.3)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, color: '#F8FAFC' },
  primaryBtn: { marginTop: 10, backgroundColor: 'rgba(0,255,136,0.1)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.4)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  primaryBtnText: { color: '#00FF88', fontWeight: '700' },
  logRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(96,165,250,0.12)' },
  logMeta: { color: '#60A5FA', fontSize: 12, marginBottom: 2 },
  logMsg: { color: '#E5E7EB', fontSize: 14 },
});