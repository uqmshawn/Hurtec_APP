import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { WebView } from 'react-native-webview';
import { ScrollView } from 'react-native';
import * as Application from 'expo-application';
import { addLog } from '../lib/logger';
import { Audio } from 'expo-av';

interface TabData {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  url: string;
  allowInsecure?: boolean;
  allowedHosts?: string;
  certFingerprintSha256?: string;
}

type CredMap = Record<string, { username: string; password: string }>;

const buildUrl = (raw: string) => {
  // Force HTTPS for all hosts and IPs to avoid http errors
  if (/^https?:\/\//i.test(raw)) {
    // normalize to https if http provided
    return raw.replace(/^http:\/\//i, 'https://');
  }
  return `https://${raw}`;
};

export default function WebDashboard() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const tab: TabData | undefined = route.params?.tab;
  const webRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creds, setCreds] = useState<CredMap>({});
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [displaySettings, setDisplaySettings] = useState<any>(null);
  const [autoTimer, setAutoTimer] = useState<NodeJS.Timer | null>(null);
  const [currentTabAllowInsecure, setCurrentTabAllowInsecure] = useState<boolean>(false);
  const [allowAllInsecure, setAllowAllInsecure] = useState<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  const [androidId, setAndroidId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>();

  useEffect(() => {
    (async () => {
      try { setAndroidId(await Application.getAndroidIdAsync()); } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('dashboard.credentials');
        if (stored) setCreds(JSON.parse(stored));
      } catch {}
      try {
        const storedTabs = await SecureStore.getItemAsync('dashboard.tabs');
        if (storedTabs) setTabs(JSON.parse(storedTabs));
      } catch {}
      try {
        const ds = await SecureStore.getItemAsync('dashboard.displaySettings');
        if (ds) {
          const parsed = JSON.parse(ds);
          setDisplaySettings(parsed);
          setAllowAllInsecure(!!parsed.allowAllInsecure);
        }
      } catch {}
    })();
  }, []);

  // Preload sound if alerts enabled
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!displaySettings?.soundAlerts) return;
        const s = new Audio.Sound();
        await s.loadAsync({ uri: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' });
        if (mounted) setSound(s);
      } catch { /* ignore */ }
    })();
    return () => { try { sound?.unloadAsync(); } catch {} mounted = false; };
  }, [displaySettings?.soundAlerts]);

  const playAlert = async () => {
    try { if (displaySettings?.soundAlerts && sound) { await sound.replayAsync(); } } catch {}
  };

  useEffect(() => {
    const t = tabs.find((t) => t.id === tab?.id) as any;
    setCurrentTabAllowInsecure(!!t?.allowInsecure);
  }, [tabs, tab?.id]);

  const startUrl = useMemo(() => buildUrl(tab?.url || ''), [tab?.url]);
  const hostKey = useMemo(() => {
    try {
      const a = document?.createElement ? document.createElement('a') : null as any;
      if (a){ a.href = startUrl; return a.host || tab?.url || ''; }
    } catch {}
    // Fallback simple parse
    const m = startUrl.replace(/^https?:\/\//,'').split('/')[0];
    return m || (tab?.url || '');
  }, [startUrl, tab?.url]);

  const injectedJS = useMemo(() => {
    const c = creds[hostKey];
    if (!c || !c.username || !c.password) return '';
    if (displaySettings && displaySettings.autoLogin === false) return '';
    // Attempt generic form fill. Sites differ; we try common selectors.
    return `(() => {
      function setVal(sel, val){
        const el = document.querySelector(sel);
        if (el){ el.value = val; el.dispatchEvent(new Event('input',{bubbles:true})); }
      }
      setVal('input[name=email]', ${JSON.stringify(c.username)});
      setVal('input[type=email]', ${JSON.stringify(c.username)});
      setVal('input[name=username]', ${JSON.stringify(c.username)});
      setVal('input#username', ${JSON.stringify(c.username)});
      setVal('input[name=password]', ${JSON.stringify(c.password)});
      setVal('input[type=password]', ${JSON.stringify(c.password)});
      const btn = document.querySelector('button[type=submit], button.login, input[type=submit]');
      if (btn) btn.click();
      true;
    })();`;
  }, [creds, hostKey, displaySettings]);

  const onNavStateChange = (state: any) => {
    setCanGoBack(state.canGoBack);
    setCanGoForward(state.canGoForward);
    // Enforce allowed host whitelist if configured
    const current = tabs.find((t) => t.id === tab?.id);
    if (current?.allowedHosts && state?.url) {
      const whitelist = current.allowedHosts.split(',').map(s => s.trim()).filter(Boolean);
      try {
        // Avoid relying on global URL in RN; do simple parse
        const clean = String(state.url).replace(/^https?:\/\//,'');
        const hostOnly = clean.split('/')[0];
        const ok = whitelist.some(w => hostOnly.endsWith(w));
        if (!ok) {
          addLog('warn', 'nav', 'Blocked navigation outside whitelist', { target: state.url, whitelist });
          webRef.current?.stopLoading?.();
          webRef.current?.injectJavaScript(`window.location.href='${startUrl}'`);
        }
      } catch {}
    }
  };

  // Per-tab auto refresh
  useEffect(() => {
    // clear previous
    if (autoTimer) {
      clearInterval(autoTimer as any);
    }
    const current = tabs.find((t) => t.id === tab?.id);
    const enabled = current?.autoRefreshEnabled;
    const seconds = Number(current?.autoRefreshSeconds || displaySettings?.refreshInterval || 0);
    const globalEnabled = displaySettings ? !!displaySettings.autoRefresh : true;
    if (enabled && globalEnabled && seconds > 0) {
      const timer = setInterval(() => {
        addLog('debug', 'refresh', 'Auto refresh tick', { tabId: tab?.id });
        webRef.current?.reload();
      }, seconds * 1000);
      setAutoTimer(timer);
      return () => clearInterval(timer as any);
    }
    return () => {};
  }, [tabs, tab?.id, displaySettings]);

  // Simple telemetry: send page open/close if enabled
  useEffect(() => {
    let aborted = false;
    const send = async (kind: string) => {
      try {
        if (!displaySettings?.enableTelemetry || !displaySettings?.telemetryEndpoint) return;
        await fetch(displaySettings.telemetryEndpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: `web_${kind}`, at: new Date().toISOString(), tab: { id: tab?.id, name: tab?.name, url: tab?.url }, deviceIdentifier: displaySettings?.manualIMEI || androidId || 'unknown' })
        });
      } catch {}
    };
    send('open');
    // heartbeat every 60s while screen is mounted
    let hb: any;
    if (displaySettings?.enableTelemetry && displaySettings?.telemetryEndpoint) {
      hb = setInterval(() => send('heartbeat'), 60000);
    }
    return () => { if (!aborted) send('close'); clearInterval(hb); };
  }, [displaySettings?.enableTelemetry, displaySettings?.telemetryEndpoint, displaySettings?.manualIMEI, androidId, tab?.id, tab?.name, tab?.url]);

  // Watchdog: timeout + backoff retries, with alerts and logs
  useEffect(() => {
    const timeoutMs = Math.max(3, Number(displaySettings?.networkTimeout || 10)) * 1000;
    const maxRetries = Math.max(0, Number(displaySettings?.maxRetries || 0));

    const schedule = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        retryCountRef.current += 1;
        addLog('warn', 'watchdog', 'Load timeout; reloading', { retry: retryCountRef.current, maxRetries, timeoutMs });
        await playAlert();
        if (retryCountRef.current <= maxRetries) {
          try { webRef.current?.reload(); } catch {}
          schedule();
        } else {
          addLog('error', 'watchdog', 'Max retries reached; giving up', {});
        }
      }, timeoutMs * Math.max(1, Math.min(3, retryCountRef.current || 1))); // simple backoff 1x..3x
    };

    // Start schedule on mount
    schedule();
    return () => { if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; } };
  }, [displaySettings?.networkTimeout, displaySettings?.maxRetries, tab?.id]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#0F172A', '#1E293B', '#334155']} style={styles.background}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('Home' as never)}>
            <Ionicons name="arrow-back" size={24} color="#60A5FA" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{tab?.name || 'Web Dashboard'}</Text>
            <Text style={styles.headerSubtitle}>{startUrl}</Text>
          </View>
          <View style={styles.controls}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Diagnostics' as never, { tabId: tab?.id } as never)}>
              <Ionicons name="bug" size={18} color="#60A5FA" />
            </TouchableOpacity>
            {(allowAllInsecure || currentTabAllowInsecure) && (
              <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 8, backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.5)' }}>
                <Text style={{ color: '#F59E0B', fontWeight: '700' }}>INSECURE</Text>
              </View>
            )}
            <TouchableOpacity style={styles.iconBtn} disabled={!canGoBack} onPress={() => webRef.current?.goBack()}>
              <Ionicons name="arrow-undo" size={20} color={canGoBack ? '#60A5FA' : '#334155'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} disabled={!canGoForward} onPress={() => webRef.current?.goForward()}>
              <Ionicons name="arrow-redo" size={20} color={canGoForward ? '#60A5FA' : '#334155'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => webRef.current?.reload()}>
              <Ionicons name="refresh" size={20} color="#60A5FA" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.webContainer}>
          {loading && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator color="#60A5FA" size="large" />
            </View>
          )}
          {/* Quick Tabs Row */}
          {tabs && tabs.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 56, paddingHorizontal: 12, paddingVertical: 8 }}>
              {tabs.map((t) => (
                <TouchableOpacity key={t.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)', backgroundColor: 'rgba(30,58,138,0.25)' }} onPress={() => webRef.current?.injectJavaScript(`window.location.href='${buildUrl(t.url)}'`)}>
                  <Ionicons name={t.icon} size={18} color="#60A5FA" />
                  <Text style={{ color: '#E5E7EB', marginLeft: 8 }}>{t.name}</Text>
                </TouchableOpacity>
              ))}
              {/* YouTube quick icon */}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.5)', backgroundColor: 'rgba(239,68,68,0.15)' }} onPress={() => webRef.current?.injectJavaScript(`window.location.href='https://m.youtube.com'`)}>
                <Ionicons name="logo-youtube" size={18} color="#EF4444" />
                <Text style={{ color: '#FCA5A5', marginLeft: 8 }}>YouTube</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
          <WebView
            ref={webRef}
            source={{ uri: startUrl }}
            onLoadEnd={() => { setLoading(false); if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; } retryCountRef.current = 0; addLog('info', 'webview', 'Load end', { url: startUrl }); }}
            onError={(e) => { addLog('error', 'webview', 'General WebView error', { e }); playAlert(); }}
            onHttpError={(e) => { addLog('error', 'webview', 'HTTP error', { statusCode: e?.nativeEvent?.statusCode, url: e?.nativeEvent?.url }); playAlert(); }}
            onNavigationStateChange={onNavStateChange}
            injectedJavaScript={injectedJS}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            originWhitelist={["*"]}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            mixedContentMode={(allowAllInsecure || displaySettings?.allowInsecureLocal || currentTabAllowInsecure) ? 'always' : 'never'}
            onContentProcessDidTerminate={() => {
              addLog('warn', 'webview', 'Content process terminated; reloading', {});
              try { webRef.current?.reload(); } catch {}
            }}
            // @ts-ignore: onReceivedSslError for Android (exposed by react-native-webview builds)
            onReceivedSslError={(event: any) => {
              const current = tabs.find((t) => t.id === tab?.id);
              const allow = (allowAllInsecure || displaySettings?.allowInsecureLocal || currentTabAllowInsecure || current?.allowInsecure);
              if (allow) {
                try {
                  // Optional rudimentary pin check: if a pin is present and mismatch, do not proceed
                  const pin = current?.certFingerprintSha256;
                  if (event?.certificateFingerprint) {
                    // Persist last seen fingerprint for Diagnostics auto-fill
                    try { SecureStore.setItemAsync('diagnostics.lastCertFingerprint', String(event.certificateFingerprint)); } catch {}
                    try { if (tab?.id) SecureStore.setItemAsync('diagnostics.lastTabId', String(tab.id)); } catch {}
                    addLog('info', 'ssl', 'Captured certificate fingerprint', { fp: event.certificateFingerprint, tabId: tab?.id });
                  }
                  if (pin && event?.proceed && event?.certificateFingerprint) {
                    if (String(event.certificateFingerprint) !== String(pin)) {
                      addLog('error', 'ssl', 'Fingerprint mismatch; cancelling', { expected: pin, got: event.certificateFingerprint });
                      event.cancel && event.cancel();
                      playAlert();
                      return;
                    }
                  }
                  addLog('warn', 'ssl', 'Proceeding through SSL error due to insecure mode', { tabId: tab?.id });
                  event.proceed();
                } catch { try { event.proceed && event.proceed(); } catch {} }
              } else {
                addLog('error', 'ssl', 'SSL error blocked (secure mode)', {});
                try { event.cancel && event.cancel(); } catch {}
                playAlert();
              }
            }}
            onLoadStart={() => {
              setLoading(true);
              addLog('debug', 'webview', 'Load start', { url: startUrl });
            }}
          />
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  background: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(96,165,250,0.2)'
  },
  backButton: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(30,58,138,0.3)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.3)'
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  controls: { flexDirection: 'row' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, marginLeft: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(30,58,138,0.25)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)'
  },
  webContainer: { flex: 1 },
  loaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
});