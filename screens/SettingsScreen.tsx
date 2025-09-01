import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { toast } from 'sonner-native';

interface SettingItem {
  id: string;
  title: string;
  subtitle?: string;
  type: 'toggle' | 'input' | 'button' | 'info';
  value?: any;
  icon: keyof typeof Ionicons.glyphMap;
}

type TabIcon = keyof typeof Ionicons.glyphMap;
interface UserTab {
  id: string;
  name: string;
  url: string;
  icon: TabIcon;
  autoRefreshEnabled?: boolean;
  autoRefreshSeconds?: string;
  allowInsecure?: boolean;
  allowedHosts?: string; // comma-separated whitelist
  certFingerprintSha256?: string; // optional pin
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [settings, setSettings] = useState({
    autoRefresh: true,
    refreshInterval: '30',
    nightMode: false,
    fullscreenMode: false,
    soundAlerts: true,
    voiceCommands: true,
    autoLogin: true,
    crashRecovery: true,
    dataLogging: true,
    networkTimeout: '10',
    maxRetries: '3',
    allowInsecureLocal: false,
    allowAllInsecure: false,
    enableTelemetry: false,
    telemetryEndpoint: '',
    manualIMEI: '',
  });

  // Device info (IMEI is not available in Expo; use Android ID as device identifier)
  const [deviceInfo, setDeviceInfo] = useState<{ androidId?: string; model?: string; os?: string; brand?: string; imeiNote?: string }>({});

  const [credentials, setCredentials] = useState({
    'demo.hurtec.com.au': { username: '', password: '' },
    'vrm.victronenergy.com': { username: '', password: '' },
    'hurtec.com.au': { username: '', password: '' },
    '192.168.1.100:8080': { username: '', password: '' },
  });

  const [tabs, setTabs] = useState<UserTab[]>([
    { id: 'hurtec-main', name: 'Hurtec Main', url: 'hurtec.com.au', icon: 'business', autoRefreshEnabled: true, autoRefreshSeconds: '60', allowInsecure: false, allowedHosts: 'hurtec.com.au', certFingerprintSha256: '' },
    { id: 'hurtec-demo', name: 'Hurtec Demo', url: 'demo.hurtec.com.au', icon: 'flask', autoRefreshEnabled: true, autoRefreshSeconds: '60', allowInsecure: false, allowedHosts: 'demo.hurtec.com.au', certFingerprintSha256: '' },
    { id: 'victron', name: 'Victron VRM', url: 'vrm.victronenergy.com', icon: 'battery-charging', autoRefreshEnabled: true, autoRefreshSeconds: '120', allowInsecure: false, allowedHosts: 'vrm.victronenergy.com', certFingerprintSha256: '' },
    { id: 'local', name: 'Local System', url: '192.168.1.100:8080', icon: 'server', autoRefreshEnabled: false, autoRefreshSeconds: '30', allowInsecure: true, allowedHosts: '192.168.1.100:8080,192.168.0.0/16', certFingerprintSha256: '' },
  ]);

  React.useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('dashboard.credentials');
        if (stored) setCredentials(JSON.parse(stored));
      } catch {}
      try {
        const storedTabs = await SecureStore.getItemAsync('dashboard.tabs');
        if (storedTabs) setTabs(JSON.parse(storedTabs));
      } catch {}
      try {
        const storedDisplay = await SecureStore.getItemAsync('dashboard.displaySettings');
        if (storedDisplay) setSettings(JSON.parse(storedDisplay));
      } catch {}
      try {
        const androidId = await Application.getAndroidId();
        const model = Device.modelName ?? 'Unknown Model';
        const os = `${Device.osName ?? 'Android'} ${Device.osVersion ?? ''}`.trim();
        const brand = Device.brand ?? 'Unknown Brand';
        setDeviceInfo({
          androidId: androidId || 'Unavailable',
          model,
          os,
          brand,
          imeiNote: 'IMEI access is restricted on modern Android and not available in Expo. Using Android ID as the device identifier.'
        });
      } catch {}
    })();
  }, []);

  const saveAll = async () => {
    try {
      await SecureStore.setItemAsync('dashboard.credentials', JSON.stringify(credentials));
      await SecureStore.setItemAsync('dashboard.tabs', JSON.stringify(tabs));
      await SecureStore.setItemAsync('dashboard.displaySettings', JSON.stringify(settings));
      Alert.alert('Saved', 'Settings, tabs and credentials saved');
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const sendTestTelemetry = async () => {
    try {
      if (!settings.enableTelemetry || !settings.telemetryEndpoint) {
        Alert.alert('Telemetry Disabled', 'Enable telemetry and set an endpoint URL to send a test.');
        return;
      }
      const payload = {
        type: 'test_telemetry',
        at: new Date().toISOString(),
        device: {
          ...deviceInfo,
          deviceIdentifier: settings.manualIMEI || deviceInfo.androidId || 'unknown'
        },
        settings: { ...settings, telemetryEndpoint: undefined },
        tabsMeta: tabs.map(t => ({ id: t.id, name: t.name, url: t.url }))
      };
      const res = await fetch(settings.telemetryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        toast.success?.('Telemetry sent');
        Alert.alert('Success', 'Telemetry test sent successfully');
      } else {
        throw new Error(`${res.status}`);
      }
    } catch (e) {
      Alert.alert('Telemetry Error', 'Failed to send telemetry. Check the endpoint and network.');
    }
  };

  const settingSections = [
    {
      title: 'Display Settings',
      items: [
        {
          id: 'autoRefresh',
          title: 'Auto Refresh',
          subtitle: 'Automatically refresh dashboard data',
          type: 'toggle',
          value: settings.autoRefresh,
          icon: 'refresh-circle'
        },
        {
          id: 'refreshInterval',
          title: 'Refresh Interval',
          subtitle: 'Seconds between updates',
          type: 'input',
          value: settings.refreshInterval,
          icon: 'time'
        },
        {
          id: 'nightMode',
          title: 'Night Mode',
          subtitle: 'Automatic dark theme at night',
          type: 'toggle',
          value: settings.nightMode,
          icon: 'moon'
        },
        {
          id: 'fullscreenMode',
          title: 'Fullscreen Mode',
          subtitle: 'Hide status bar and navigation',
          type: 'toggle',
          value: settings.fullscreenMode,
          icon: 'expand'
        },
        {
          id: 'allowInsecureLocal',
          title: 'Developer: Allow insecure local (self-signed/HTTP)',
          subtitle: 'Permits loading private IPs and .local with invalid certs',
          type: 'toggle',
          value: settings.allowInsecureLocal,
          icon: 'warning'
        },
        {
          id: 'allowAllInsecure',
          title: 'ALLOW ALL (insecure): accept any cert + mixed content',
          subtitle: 'Bypass SSL errors and allow HTTP/mixed content – use with caution',
          type: 'toggle',
          value: settings.allowAllInsecure,
          icon: 'alert'
        }
      ]
    },
    {
      title: 'Telemetry & Backend',
      items: [
        {
          id: 'enableTelemetry',
          title: 'Enable Telemetry',
          subtitle: 'Send status/events to your backend endpoint',
          type: 'toggle',
          value: settings.enableTelemetry,
          icon: 'cloud'
        },
        {
          id: 'telemetryEndpoint',
          title: 'Telemetry Endpoint URL',
          subtitle: 'POST JSON here for logs and device status',
          type: 'input',
          value: settings.telemetryEndpoint,
          icon: 'link'
        },
      ]
    },
    {
      title: 'Device Identification',
      items: [
        {
          id: 'manualIMEI',
          title: 'Manual IMEI (override)',
          subtitle: 'Enter device IMEI to display and use in telemetry',
          type: 'input',
          value: settings.manualIMEI,
          icon: 'barcode'
        }
      ]
    },
    {
      title: 'Audio & Alerts',
      items: [
        {
          id: 'soundAlerts',
          title: 'Sound Alerts',
          subtitle: 'Play sounds for system alerts',
          type: 'toggle',
          value: settings.soundAlerts,
          icon: 'volume-high'
        },
        {
          id: 'voiceCommands',
          title: 'Voice Commands',
          subtitle: 'Enable voice control features',
          type: 'toggle',
          value: settings.voiceCommands,
          icon: 'mic'
        }
      ]
    },
    {
      title: 'System Settings',
      items: [
        {
          id: 'autoLogin',
          title: 'Auto Login',
          subtitle: 'Automatically login to systems',
          type: 'toggle',
          value: settings.autoLogin,
          icon: 'key'
        },
        {
          id: 'crashRecovery',
          title: 'Crash Recovery',
          subtitle: 'Auto-restart failed components',
          type: 'toggle',
          value: settings.crashRecovery,
          icon: 'shield-checkmark'
        },
        {
          id: 'dataLogging',
          title: 'Data Logging',
          subtitle: 'Log system data for analysis',
          type: 'toggle',
          value: settings.dataLogging,
          icon: 'document-text'
        }
      ]
    },
    {
      title: 'Network Settings',
      items: [
        {
          id: 'networkTimeout',
          title: 'Network Timeout',
          subtitle: 'Seconds to wait for response',
          type: 'input',
          value: settings.networkTimeout,
          icon: 'wifi'
        },
        {
          id: 'maxRetries',
          title: 'Max Retries',
          subtitle: 'Maximum connection attempts',
          type: 'input',
          value: settings.maxRetries,
          icon: 'repeat'
        }
      ]
    },
    {
      title: 'System Information',
      items: [
        {
          id: 'version',
          title: 'App Version',
          subtitle: '2.1.0 (Build 2025.01)',
          type: 'info',
          icon: 'information-circle'
        },
        {
          id: 'lastUpdate',
          title: 'Last Update',
          subtitle: 'January 4, 2025',
          type: 'info',
          icon: 'calendar'
        },
        {
          id: 'deviceId',
          title: 'Device ID (Android ID)',
          subtitle: deviceInfo.androidId || '—',
          type: 'info',
          icon: 'qr-code'
        },
        {
          id: 'imeiInfo',
          title: 'IMEI',
          subtitle: settings.manualIMEI || deviceInfo.imeiNote || 'IMEI unavailable in this environment',
          type: 'info',
          icon: 'phone-portrait'
        },
        {
          id: 'model',
          title: 'Model / Brand',
          subtitle: `${deviceInfo.brand ?? ''} ${deviceInfo.model ?? ''}`.trim() || '—',
          type: 'info',
          icon: 'hardware-chip'
        },
        {
          id: 'os',
          title: 'OS',
          subtitle: deviceInfo.os || '—',
          type: 'info',
          icon: 'tablet-portrait'
        }
      ]
    },
    {
      title: 'Actions',
      items: [
        {
          id: 'openDiagnostics',
          title: 'Open Diagnostics',
          subtitle: 'View logs and trust certificate',
          type: 'button',
          icon: 'bug'
        },
        {
          id: 'clearCache',
          title: 'Clear Cache',
          subtitle: 'Clear stored data and images',
          type: 'button',
          icon: 'trash'
        },
        {
          id: 'resetSettings',
          title: 'Reset Settings',
          subtitle: 'Restore default configuration',
          type: 'button',
          icon: 'refresh'
        },
        {
          id: 'exportLogs',
          title: 'Export Logs',
          subtitle: 'Export system logs for support',
          type: 'button',
          icon: 'download'
        },
        {
          id: 'sendTelemetry',
          title: 'Send Test Telemetry',
          subtitle: 'POST a test payload to your endpoint',
          type: 'button',
          icon: 'paper-plane'
        }
      ]
    }
  ];

  const handleSettingChange = (id: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleButtonPress = (id: string) => {
    switch (id) {
      case 'openDiagnostics':
        // @ts-ignore
        navigation.navigate('Diagnostics');
        break;
      case 'clearCache':
        Alert.alert(
          'Clear Cache',
          'This will clear all cached data. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: async () => {
              await SecureStore.deleteItemAsync('dashboard.tabs');
              await SecureStore.deleteItemAsync('dashboard.credentials');
              await SecureStore.deleteItemAsync('dashboard.displaySettings');
              Alert.alert('Success', 'Cache cleared successfully');
            }}
          ]
        );
        break;
      case 'resetSettings':
        Alert.alert(
          'Reset Settings',
          'This will restore all settings to default values. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: async () => {
              setSettings({
                autoRefresh: true,
                refreshInterval: '30',
                nightMode: false,
                fullscreenMode: false,
                soundAlerts: true,
                voiceCommands: true,
                autoLogin: true,
                crashRecovery: true,
                dataLogging: true,
                networkTimeout: '10',
                maxRetries: '3',
                allowInsecureLocal: false,
                allowAllInsecure: false,
                enableTelemetry: false,
                telemetryEndpoint: '',
                manualIMEI: '',
              });
              setTabs([
                { id: 'hurtec-main', name: 'Hurtec Main', url: 'hurtec.com.au', icon: 'business', autoRefreshEnabled: true, autoRefreshSeconds: '60' },
                { id: 'hurtec-demo', name: 'Hurtec Demo', url: 'demo.hurtec.com.au', icon: 'flask', autoRefreshEnabled: true, autoRefreshSeconds: '60' },
                { id: 'victron', name: 'Victron VRM', url: 'vrm.victronenergy.com', icon: 'battery-charging', autoRefreshEnabled: true, autoRefreshSeconds: '120' },
                { id: 'local', name: 'Local System', url: '192.168.1.100:8080', icon: 'server', autoRefreshEnabled: false, autoRefreshSeconds: '30' },
              ]);
              setCredentials({
                'demo.hurtec.com.au': { username: '', password: '' },
                'vrm.victronenergy.com': { username: '', password: '' },
                'hurtec.com.au': { username: '', password: '' },
                '192.168.1.100:8080': { username: '', password: '' },
              });
              await SecureStore.deleteItemAsync('dashboard.tabs');
              await SecureStore.deleteItemAsync('dashboard.credentials');
              await SecureStore.deleteItemAsync('dashboard.displaySettings');
              Alert.alert('Success', 'Settings reset to defaults');
            }}
          ]
        );
        break;
      case 'exportLogs':
        // Navigate to Diagnostics where export is available
        // @ts-ignore
        navigation.navigate('Diagnostics');
        break;
      case 'sendTelemetry':
        sendTestTelemetry();
        break;
    }
  };

  const renderSettingItem = (item: SettingItem) => {
    return (
      <View key={item.id} style={styles.settingItem}>
        <LinearGradient
          colors={['rgba(30, 58, 138, 0.2)', 'rgba(15, 23, 42, 0.4)']}
          style={styles.settingItemGradient}
        >
          <View style={styles.settingItemLeft}>
            <Ionicons name={item.icon} size={24} color="#60A5FA" />
            <View style={styles.settingItemText}>
              <Text style={styles.settingItemTitle}>{item.title}</Text>
              {item.subtitle && (
                <Text style={styles.settingItemSubtitle}>{item.subtitle}</Text>
              )}
            </View>
          </View>
          
          <View style={styles.settingItemRight}>
            {item.type === 'toggle' && (
              <Switch
                value={item.value}
                onValueChange={(value) => handleSettingChange(item.id, value)}
                trackColor={{ false: '#374151', true: '#059669' }}
                thumbColor={item.value ? '#00FF88' : '#9CA3AF'}
              />
            )}
            
            {item.type === 'input' && (
              <TextInput
                style={styles.settingInput}
                value={item.value}
                onChangeText={(value) => handleSettingChange(item.id, value)}
                keyboardType={/refreshInterval|networkTimeout|maxRetries/i.test(item.id) ? 'numeric' : 'default'}
                placeholderTextColor="#6B7280"
              />
            )}
            
            {item.type === 'button' && (
              <TouchableOpacity
                style={styles.settingButton}
                onPress={() => handleButtonPress(item.id)}
              >
                <Text style={styles.settingButtonText}>Execute</Text>
              </TouchableOpacity>
            )}
            
            {item.type === 'info' && (
              <Ionicons name="chevron-forward" size={20} color="#6B7280" />
            )}
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={styles.background}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#60A5FA" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>Dashboard Configuration</Text>
          </View>
          
          <TouchableOpacity style={styles.saveButton} onPress={saveAll}>
            <Ionicons name="checkmark" size={24} color="#00FF88" />
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Content */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Tabs Manager Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tabs Manager</Text>
            {tabs.map((t, idx) => (
              <View key={t.id} style={styles.settingItem}>
                <LinearGradient colors={['rgba(30, 58, 138, 0.2)', 'rgba(15, 23, 42, 0.4)']} style={styles.settingItemGradient}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name={t.icon} size={20} color="#60A5FA" />
                      <Text style={[styles.settingItemTitle, { marginLeft: 8 }]}>{t.name || 'Unnamed Tab'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 12 }}>
                      <TextInput
                        style={[styles.settingInput, { flex: 1, marginRight: 8, textAlign: 'left' }]}
                        value={t.name}
                        onChangeText={(v) => setTabs(prev => prev.map((p, i) => i===idx ? { ...p, name: v } : p))}
                        placeholder="Tab Name"
                        placeholderTextColor="#6B7280"
                      />
                      <TextInput
                        style={[styles.settingInput, { flex: 1, marginLeft: 8, textAlign: 'left' }]}
                        value={t.url}
                        onChangeText={(v) => setTabs(prev => prev.map((p, i) => i===idx ? { ...p, url: v } : p))}
                        placeholder="URL or host (e.g. hurtec.com.au)"
                        placeholderTextColor="#6B7280"
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 12, alignItems: 'center' }}>
                      <Text style={{ color: '#94A3B8', marginRight: 8 }}>Icon</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {(['business','flask','battery-charging','server','globe','flash','speedometer','construct','cube','cloud'] as TabIcon[]).map(ic => (
                          <TouchableOpacity
                            key={ic}
                            onPress={() => setTabs(prev => prev.map((p, i) => i===idx ? { ...p, icon: ic } : p))}
                            style={{
                              padding: 8, marginRight: 8, borderRadius: 8,
                              borderWidth: 1,
                              borderColor: t.icon === ic ? 'rgba(0,255,136,0.6)' : 'rgba(96,165,250,0.3)',
                              backgroundColor: t.icon === ic ? 'rgba(0,255,136,0.08)' : 'rgba(30,58,138,0.2)'
                            }}
                          >
                            <Ionicons name={ic} size={18} color={t.icon === ic ? '#00FF88' : '#60A5FA'} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 12, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: '#94A3B8', marginRight: 10 }}>Auto-refresh</Text>
                        <Switch
                          value={!!t.autoRefreshEnabled}
                          onValueChange={(value) => setTabs(prev => prev.map((p, i) => i===idx ? { ...p, autoRefreshEnabled: value } : p))}
                          trackColor={{ false: '#374151', true: '#059669' }}
                          thumbColor={t.autoRefreshEnabled ? '#00FF88' : '#9CA3AF'}
                        />
                        <Text style={{ color: '#94A3B8', marginLeft: 16, marginRight: 8 }}>Every (s)</Text>
                        <TextInput
                          style={[styles.settingInput, { width: 100, textAlign: 'center' }]}
                          value={t.autoRefreshSeconds || ''}
                          onChangeText={(v) => setTabs(prev => prev.map((p, i) => i===idx ? { ...p, autoRefreshSeconds: v.replace(/[^0-9]/g,'') } : p))}
                          keyboardType="numeric"
                          placeholder="60"
                          placeholderTextColor="#6B7280"
                        />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#94A3B8', marginRight: 8 }}>Allow insecure</Text>
                        <Switch
                          value={!!t.allowInsecure}
                          onValueChange={(value) => setTabs(prev => prev.map((p, i) => i===idx ? { ...p, allowInsecure: value } : p))}
                          trackColor={{ false: '#374151', true: '#F59E0B' }}
                          thumbColor={t.allowInsecure ? '#F59E0B' : '#9CA3AF'}
                        />
                      </View>
                      <TouchableOpacity onPress={() => setTabs(prev => prev.filter((_, i) => i!==idx))} style={[styles.settingButton, { marginLeft: 12 }]}>
                        <Text style={styles.settingButtonText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                    {/* Allowed hosts whitelist and cert pin */}
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ color: '#94A3B8', marginBottom: 6 }}>Allowed hosts (comma separated)</Text>
                      <TextInput
                        style={[styles.settingInput, { textAlign: 'left' }]}
                        value={t.allowedHosts || ''}
                        onChangeText={(v) => setTabs(prev => prev.map((p, i) => i===idx ? { ...p, allowedHosts: v } : p))}
                        placeholder="e.g. 192.168.82.120:8080,vrm.victronenergy.com"
                        placeholderTextColor="#6B7280"
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ color: '#94A3B8', marginBottom: 6 }}>Certificate fingerprint (SHA-256, optional)</Text>
                      <TextInput
                        style={[styles.settingInput, { textAlign: 'left' }]}
                        value={t.certFingerprintSha256 || ''}
                        onChangeText={(v) => setTabs(prev => prev.map((p, i) => i===idx ? { ...p, certFingerprintSha256: v.trim() } : p))}
                        placeholder="sha256/BASE64=="
                        placeholderTextColor="#6B7280"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </LinearGradient>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.settingButton, { alignSelf: 'flex-start', marginTop: 8 }]}
              onPress={() => setTabs(prev => ([...prev, { id: `tab-${Date.now()}`, name: 'New Tab', url: '', icon: 'globe', autoRefreshEnabled: false, autoRefreshSeconds: '60', allowInsecure: false, allowedHosts: '', certFingerprintSha256: '' }]))}
            >
              <Text style={styles.settingButtonText}>+ Add Tab</Text>
            </TouchableOpacity>
          </View>

          {/* Credentials Section with editable hosts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Credentials</Text>
            {Object.keys(credentials).map((host) => (
              <View key={host} style={styles.settingItem}>
                <LinearGradient
                  colors={['rgba(30, 58, 138, 0.2)', 'rgba(15, 23, 42, 0.4)']}
                  style={styles.settingItemGradient}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row' }}>
                      <TextInput
                        style={[styles.settingInput, { flex: 1, textAlign: 'left' }]}
                        value={host}
                        onChangeText={(newHost) => setCredentials((prev) => {
                          const copy: any = { ...prev };
                          const val = copy[host];
                          delete copy[host];
                          copy[newHost] = val;
                          return copy;
                        })}
                        placeholder="host (e.g. demo.hurtec.com.au)"
                        placeholderTextColor="#6B7280"
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={{ flexDirection: 'row', marginTop: 12 }}>
                      <TextInput
                        style={[styles.settingInput, { flex: 1, marginRight: 8 }]}
                        value={credentials[host as keyof typeof credentials].username}
                        onChangeText={(v) => setCredentials((prev) => ({ ...prev, [host]: { ...prev[host as keyof typeof prev], username: v } }))}
                        placeholder="Username / Email"
                        placeholderTextColor="#6B7280"
                        autoCapitalize="none"
                      />
                      <TextInput
                        style={[styles.settingInput, { flex: 1, marginLeft: 8 }]}
                        value={credentials[host as keyof typeof credentials].password}
                        onChangeText={(v) => setCredentials((prev) => ({ ...prev, [host]: { ...prev[host as keyof typeof prev], password: v } }))}
                        placeholder="Password"
                        placeholderTextColor="#6B7280"
                        secureTextEntry
                      />
                    </View>
                  </View>
                </LinearGradient>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.settingButton, { alignSelf: 'flex-start', marginTop: 8 }]}
              onPress={() => setCredentials(prev => ({ ...prev, 'new-host': { username: '', password: '' } }))}
            >
              <Text style={styles.settingButtonText}>+ Add Credential</Text>
            </TouchableOpacity>
          </View>

          {settingSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              
              {section.items.map((item) => renderSettingItem(item as SettingItem))}
            </View>
          ))}
          
          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Hurtec & Victron Industrial Dashboard
            </Text>
            <Text style={styles.footerSubtext}>
              Designed for automotive head units
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  background: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 165, 250, 0.2)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 58, 138, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  saveButtonText: {
    color: '#00FF88',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 16,
    paddingLeft: 4,
  },
  settingItem: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  settingItemGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemText: {
    marginLeft: 12,
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  settingItemSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  settingItemRight: {
    marginLeft: 16,
  },
  settingInput: {
    backgroundColor: 'rgba(30, 58, 138, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 16,
    minWidth: 80,
    textAlign: 'center',
  },
  settingButton: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingButtonText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(96, 165, 250, 0.2)',
    marginTop: 32,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#60A5FA',
  },
  footerSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
});