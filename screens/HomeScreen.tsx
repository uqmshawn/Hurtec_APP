import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';

const { width, height } = Dimensions.get('window');

interface SystemStatus {
  name: string;
  status: 'online' | 'offline' | 'warning';
  lastUpdate: string;
  data?: any;
}

interface TabData {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  url: string;
  status: SystemStatus;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [displaySettings, setDisplaySettings] = useState<any>(null);
  const [userTabs, setUserTabs] = useState<{ id: string; name: string; icon: keyof typeof Ionicons.glyphMap; url: string; autoRefreshEnabled?: boolean; autoRefreshSeconds?: string; allowInsecure?: boolean; allowedHosts?: string; certFingerprintSha256?: string; }[] | null>(null);

  const defaultTabs: TabData[] = [
    {
      id: 'hurtec-main',
      name: 'Hurtec Main',
      icon: 'business',
      url: 'hurtec.com.au',
      status: {
        name: 'Hurtec Main System',
        status: 'online',
        lastUpdate: '2 min ago',
        data: { temperature: '24°C', pressure: '1.2 bar', flow: '85 L/min' }
      }
    },
    {
      id: 'hurtec-demo',
      name: 'Hurtec Demo',
      icon: 'flask',
      url: 'demo.hurtec.com.au',
      status: {
        name: 'Hurtec Demo System',
        status: 'online',
        lastUpdate: '1 min ago',
        data: { power: '2.4 kW', efficiency: '94%', runtime: '12h 34m' }
      }
    },
    {
      id: 'victron',
      name: 'Victron VRM',
      icon: 'battery-charging',
      url: 'vrm.victronenergy.com',
      status: {
        name: 'Victron Energy System',
        status: 'warning',
        lastUpdate: '5 min ago',
        data: { battery: '87%', solar: '1.8 kW', load: '0.9 kW' }
      }
    },
    {
      id: 'local',
      name: 'Local System',
      icon: 'server',
      url: '192.168.1.100:8080',
      status: {
        name: 'Local Monitoring',
        status: 'online',
        lastUpdate: '30 sec ago',
        data: { cpu: '45%', memory: '62%', disk: '78%' }
      }
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const storedTabs = await SecureStore.getItemAsync('dashboard.tabs');
        if (storedTabs) {
          const parsed = JSON.parse(storedTabs) as { id: string; name: string; icon: keyof typeof Ionicons.glyphMap; url: string; autoRefreshEnabled?: boolean; autoRefreshSeconds?: string; allowInsecure?: boolean; allowedHosts?: string; certFingerprintSha256?: string; }[];
          setUserTabs(parsed);
        }
      } catch {}
      try {
        const ds = await SecureStore.getItemAsync('dashboard.displaySettings');
        if (ds) {
          const parsed = JSON.parse(ds);
          setDisplaySettings(parsed);
          setIsFullscreen(!!parsed.fullscreenMode);
        }
      } catch {}
    })();
  }, []);

  // Re-load tabs whenever screen is focused so newly added tabs in Settings appear
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const storedTabs = await SecureStore.getItemAsync('dashboard.tabs');
          if (storedTabs && mounted) {
            const parsed = JSON.parse(storedTabs) as { id: string; name: string; icon: keyof typeof Ionicons.glyphMap; url: string; autoRefreshEnabled?: boolean; autoRefreshSeconds?: string; allowInsecure?: boolean; allowedHosts?: string; certFingerprintSha256?: string; }[];
            setUserTabs(parsed);
          }
        } catch {}
        try {
          const ds = await SecureStore.getItemAsync('dashboard.displaySettings');
          if (ds && mounted) {
            const parsed = JSON.parse(ds);
            setDisplaySettings(parsed);
            setIsFullscreen(!!parsed.fullscreenMode);
          }
        } catch {}
      })();
      return () => { mounted = false; };
    }, [])
  );

  const tabs: TabData[] = (userTabs && userTabs.length ? userTabs : defaultTabs).map((t) => {
    // Use user tab data first, fallback to default status if needed
    const defaultTab = defaultTabs.find(d => d.id === t.id);
    return {
      id: t.id,
      name: t.name,
      icon: t.icon,
      url: t.url,
      status: defaultTab?.status ?? {
        name: t.name,
        status: 'online',
        lastUpdate: '—',
        data: {}
      }
    } as TabData;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#00FF88';
      case 'warning': return '#FFB800';
      case 'offline': return '#FF4444';
      default: return '#6C7B7F';
    }
  };

  const handleSystemCardPress = (tab: TabData) => {
    // Navigate to embedded web dashboard for this tab
    navigation.navigate('WebDashboard' as never, { tab } as never);
  };

  const renderSystemCard = (tab: TabData) => (
    <TouchableOpacity 
      style={styles.systemCard}
      onPress={() => handleSystemCardPress(tab)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['rgba(30, 58, 138, 0.3)', 'rgba(15, 23, 42, 0.8)']}
        style={styles.cardGradient}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Ionicons name={tab.icon} size={24} color="#60A5FA" />
            <Text style={styles.cardTitle}>{tab.status.name}</Text>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(tab.status.status) }]} />
          </View>
          <Text style={styles.lastUpdate}>Last update: {tab.status.lastUpdate}</Text>
        </View>
        
        <View style={styles.dataGrid}>
          {Object.entries(tab.status.data || {}).map(([key, value]) => (
            <View key={key} style={styles.dataItem}>
              <Text style={styles.dataLabel}>{key.toUpperCase()}</Text>
              <Text style={styles.dataValue}>{value}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={isFullscreen} />
      
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={styles.background}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Industrial Dashboard</Text>
            <Text style={styles.headerSubtitle}>Hurtec & Victron Monitoring</Text>
          </View>
          
          <View style={styles.headerCenter}>
            <Text style={styles.timeText}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.dateText}>
              {currentTime.toLocaleDateString()}
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => setIsFullscreen(!isFullscreen)}
            >
              <Ionicons 
                name={isFullscreen ? "contract" : "expand"} 
                size={20} 
                color="#60A5FA" 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton}>
              <Ionicons name="refresh" size={20} color="#60A5FA" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => navigation.navigate('WebDashboard' as never, { tab: tabs[activeTab] } as never)}
            >
              <Ionicons name="globe" size={20} color="#60A5FA" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => navigation.navigate('WebDashboard' as never, { tab: { id: 'youtube', name: 'YouTube', icon: 'logo-youtube', url: 'https://m.youtube.com' } } as never)}
            >
              <Ionicons name="logo-youtube" size={20} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => navigation.navigate('Settings' as never)}
            >
              <Ionicons name="settings" size={20} color="#60A5FA" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => navigation.navigate('Diagnostics' as never)}
            >
              <Ionicons name="bug" size={20} color="#60A5FA" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabScrollView}
          >
            {tabs.map((tab, index) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === index && styles.activeTab
                ]}
                onPress={() => setActiveTab(index)}
                onLongPress={() => navigation.navigate('WebDashboard' as never, { tab } as never)}
              >
                <Ionicons 
                  name={tab.icon} 
                  size={24} 
                  color={activeTab === index ? '#00FF88' : '#60A5FA'} 
                />
                <Text style={[
                  styles.tabText,
                  activeTab === index && styles.activeTabText
                ]}>
                  {tab.name}
                </Text>
                <View style={[
                  styles.tabStatusDot,
                  { backgroundColor: getStatusColor(tab.status.status) }
                ]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <ScrollView style={styles.contentScrollView}>
            {/* Active System Display */}
            <View style={styles.activeSystemContainer}>
              {renderSystemCard(tabs[activeTab])}
            </View>

            {/* System Overview Grid */}
            <View style={styles.overviewGrid}>
              <Text style={styles.sectionTitle}>System Overview</Text>
              <View style={styles.gridContainer}>
                {tabs.map((tab, index) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.overviewCard,
                      index === activeTab && styles.activeOverviewCard
                    ]}
                    onPress={() => setActiveTab(index)}
                  >
                    <LinearGradient
                      colors={index === activeTab ? 
                        ['rgba(0, 255, 136, 0.1)', 'rgba(30, 58, 138, 0.2)'] :
                        ['rgba(30, 58, 138, 0.1)', 'rgba(15, 23, 42, 0.3)']
                      }
                      style={styles.overviewCardGradient}
                    >
                      <Ionicons 
                        name={tab.icon} 
                        size={32} 
                        color={index === activeTab ? '#00FF88' : '#60A5FA'} 
                      />
                      <Text style={[
                        styles.overviewCardTitle,
                        index === activeTab && styles.activeOverviewCardTitle
                      ]}>
                        {tab.name}
                      </Text>
                      <View style={[
                        styles.overviewStatusDot,
                        { backgroundColor: getStatusColor(tab.status.status) }
                      ]} />
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 165, 250, 0.2)',
  },
  headerLeft: {
    flex: 1,
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
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  timeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00FF88',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  dateText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'flex-end',
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 58, 138, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  tabContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 165, 250, 0.2)',
  },
  tabScrollView: {
    paddingHorizontal: 24,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 58, 138, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    minWidth: 140,
  },
  activeTab: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: 'rgba(0, 255, 136, 0.5)',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  activeTabText: {
    color: '#00FF88',
  },
  tabStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  contentScrollView: {
    flex: 1,
    padding: 24,
  },
  activeSystemContainer: {
    marginBottom: 32,
  },
  systemCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  cardGradient: {
    padding: 24,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginLeft: 12,
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  lastUpdate: {
    fontSize: 14,
    color: '#94A3B8',
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dataItem: {
    width: '30%',
    marginBottom: 16,
  },
  dataLabel: {
    fontSize: 12,
    color: '#60A5FA',
    fontWeight: '600',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F8FAFC',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  overviewGrid: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  overviewCard: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  activeOverviewCard: {
    borderColor: 'rgba(0, 255, 136, 0.5)',
  },
  overviewCardGradient: {
    padding: 16,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  overviewCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  activeOverviewCardTitle: {
    color: '#00FF88',
  },
  overviewStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
});