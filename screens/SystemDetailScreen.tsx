import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

interface MetricData {
  label: string;
  value: string;
  unit?: string;
  status: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  history: number[];
}

interface SystemDetailProps {
  system: {
    id: string;
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    url: string;
    status: {
      name: string;
      status: 'online' | 'offline' | 'warning';
      lastUpdate: string;
      data?: any;
    };
  };
}

export default function SystemDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { system } = route.params as SystemDetailProps;
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');

  const timeRanges = ['15m', '1h', '6h', '24h', '7d'];

  // Mock detailed metrics based on system type
  const getSystemMetrics = (): MetricData[] => {
    switch (system.id) {
      case 'hurtec-main':
        return [
          {
            label: 'Temperature',
            value: '24.2',
            unit: '°C',
            status: 'normal',
            trend: 'stable',
            history: [23.8, 24.0, 24.1, 24.2, 24.1, 24.2, 24.3, 24.2]
          },
          {
            label: 'Pressure',
            value: '1.24',
            unit: 'bar',
            status: 'normal',
            trend: 'up',
            history: [1.20, 1.21, 1.22, 1.23, 1.24, 1.24, 1.24, 1.24]
          },
          {
            label: 'Flow Rate',
            value: '85.3',
            unit: 'L/min',
            status: 'normal',
            trend: 'stable',
            history: [84.8, 85.0, 85.2, 85.3, 85.1, 85.3, 85.4, 85.3]
          },
          {
            label: 'Power Consumption',
            value: '2.8',
            unit: 'kW',
            status: 'normal',
            trend: 'down',
            history: [3.2, 3.1, 3.0, 2.9, 2.8, 2.8, 2.8, 2.8]
          },
          {
            label: 'Efficiency',
            value: '94.2',
            unit: '%',
            status: 'normal',
            trend: 'up',
            history: [93.8, 93.9, 94.0, 94.1, 94.2, 94.2, 94.2, 94.2]
          },
          {
            label: 'Vibration',
            value: '0.8',
            unit: 'mm/s',
            status: 'normal',
            trend: 'stable',
            history: [0.7, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8]
          }
        ];
      case 'victron':
        return [
          {
            label: 'Battery Level',
            value: '87.4',
            unit: '%',
            status: 'normal',
            trend: 'down',
            history: [89.2, 88.8, 88.4, 88.0, 87.6, 87.4, 87.4, 87.4]
          },
          {
            label: 'Solar Power',
            value: '1.85',
            unit: 'kW',
            status: 'normal',
            trend: 'up',
            history: [1.2, 1.4, 1.6, 1.7, 1.8, 1.85, 1.85, 1.85]
          },
          {
            label: 'Load Power',
            value: '0.92',
            unit: 'kW',
            status: 'normal',
            trend: 'stable',
            history: [0.9, 0.91, 0.92, 0.92, 0.92, 0.92, 0.92, 0.92]
          },
          {
            label: 'Battery Voltage',
            value: '13.2',
            unit: 'V',
            status: 'warning',
            trend: 'down',
            history: [13.8, 13.6, 13.4, 13.3, 13.2, 13.2, 13.2, 13.2]
          },
          {
            label: 'Charge Current',
            value: '12.4',
            unit: 'A',
            status: 'normal',
            trend: 'up',
            history: [8.2, 9.4, 10.6, 11.7, 12.0, 12.4, 12.4, 12.4]
          },
          {
            label: 'Temperature',
            value: '28.5',
            unit: '°C',
            status: 'normal',
            trend: 'stable',
            history: [28.2, 28.3, 28.4, 28.5, 28.5, 28.5, 28.5, 28.5]
          }
        ];
      default:
        return [
          {
            label: 'CPU Usage',
            value: '45.2',
            unit: '%',
            status: 'normal',
            trend: 'stable',
            history: [44.8, 45.0, 45.1, 45.2, 45.1, 45.2, 45.3, 45.2]
          },
          {
            label: 'Memory Usage',
            value: '62.1',
            unit: '%',
            status: 'normal',
            trend: 'up',
            history: [60.2, 60.8, 61.4, 61.8, 62.0, 62.1, 62.1, 62.1]
          },
          {
            label: 'Disk Usage',
            value: '78.3',
            unit: '%',
            status: 'warning',
            trend: 'up',
            history: [76.8, 77.2, 77.6, 78.0, 78.2, 78.3, 78.3, 78.3]
          },
          {
            label: 'Network I/O',
            value: '24.5',
            unit: 'MB/s',
            status: 'normal',
            trend: 'stable',
            history: [24.2, 24.3, 24.4, 24.5, 24.4, 24.5, 24.6, 24.5]
          }
        ];
    }
  };

  const [metrics] = useState<MetricData[]>(getSystemMetrics());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'normal': return '#00FF88';
      case 'warning': return '#FFB800';
      case 'offline':
      case 'critical': return '#FF4444';
      default: return '#6C7B7F';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      case 'stable': return 'remove';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return '#00FF88';
      case 'down': return '#FF4444';
      case 'stable': return '#60A5FA';
      default: return '#6C7B7F';
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const renderMetricCard = (metric: MetricData, index: number) => (
    <View key={index} style={styles.metricCard}>
      <LinearGradient
        colors={['rgba(30, 58, 138, 0.3)', 'rgba(15, 23, 42, 0.8)']}
        style={styles.metricCardGradient}
      >
        <View style={styles.metricHeader}>
          <Text style={styles.metricLabel}>{metric.label}</Text>
          <View style={styles.metricStatus}>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: getStatusColor(metric.status) }
            ]} />
            <Ionicons
              name={getTrendIcon(metric.trend)}
              size={16}
              color={getTrendColor(metric.trend)}
              style={styles.trendIcon}
            />
          </View>
        </View>
        
        <View style={styles.metricValue}>
          <Text style={styles.metricNumber}>{metric.value}</Text>
          {metric.unit && (
            <Text style={styles.metricUnit}>{metric.unit}</Text>
          )}
        </View>
        
        {/* Simple trend visualization */}
        <View style={styles.trendContainer}>
          {metric.history.map((value, idx) => (
            <View
              key={idx}
              style={[
                styles.trendBar,
                {
                  height: Math.max(4, (value / Math.max(...metric.history)) * 20),
                  backgroundColor: idx === metric.history.length - 1 ? 
                    getStatusColor(metric.status) : 'rgba(96, 165, 250, 0.3)'
                }
              ]}
            />
          ))}
        </View>
      </LinearGradient>
    </View>
  );

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
            <View style={styles.systemInfo}>
              <Ionicons name={system.icon} size={28} color="#60A5FA" />
              <View style={styles.systemText}>
                <Text style={styles.headerTitle}>{system.status.name}</Text>
                <Text style={styles.headerSubtitle}>{system.url}</Text>
              </View>
              <View style={[
                styles.systemStatusDot,
                { backgroundColor: getStatusColor(system.status.status) }
              ]} />
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.refreshButton, refreshing && styles.refreshingButton]}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Ionicons
              name="refresh"
              size={24}
              color="#60A5FA"
              style={[refreshing && styles.spinning]}
            />
          </TouchableOpacity>
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.timeRangeScrollView}
          >
            {timeRanges.map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeRangeButton,
                  selectedTimeRange === range && styles.activeTimeRangeButton
                ]}
                onPress={() => setSelectedTimeRange(range)}
              >
                <Text style={[
                  styles.timeRangeText,
                  selectedTimeRange === range && styles.activeTimeRangeText
                ]}>
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <View style={styles.lastUpdateContainer}>
            <Text style={styles.lastUpdateText}>
              Last update: {system.status.lastUpdate}
            </Text>
            <Text style={styles.currentTimeText}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          </View>
        </View>

        {/* Metrics Grid */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.metricsGrid}>
            {metrics.map((metric, index) => renderMetricCard(metric, index))}
          </View>
          
          {/* System Actions */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>System Actions</Text>
            
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={styles.actionButton}>
                <LinearGradient
                  colors={['rgba(30, 58, 138, 0.3)', 'rgba(15, 23, 42, 0.6)']}
                  style={styles.actionButtonGradient}
                >
                  <Ionicons name="play" size={24} color="#00FF88" />
                  <Text style={styles.actionButtonText}>Start</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton}>
                <LinearGradient
                  colors={['rgba(30, 58, 138, 0.3)', 'rgba(15, 23, 42, 0.6)']}
                  style={styles.actionButtonGradient}
                >
                  <Ionicons name="pause" size={24} color="#FFB800" />
                  <Text style={styles.actionButtonText}>Pause</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton}>
                <LinearGradient
                  colors={['rgba(30, 58, 138, 0.3)', 'rgba(15, 23, 42, 0.6)']}
                  style={styles.actionButtonGradient}
                >
                  <Ionicons name="stop" size={24} color="#FF4444" />
                  <Text style={styles.actionButtonText}>Stop</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton}>
                <LinearGradient
                  colors={['rgba(30, 58, 138, 0.3)', 'rgba(15, 23, 42, 0.6)']}
                  style={styles.actionButtonGradient}
                >
                  <Ionicons name="settings" size={24} color="#60A5FA" />
                  <Text style={styles.actionButtonText}>Configure</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
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
  systemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  systemText: {
    marginLeft: 12,
    marginRight: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  systemStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 58, 138, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  refreshingButton: {
    opacity: 0.6,
  },
  spinning: {
    // Add rotation animation if needed
  },
  timeRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(96, 165, 250, 0.2)',
  },
  timeRangeScrollView: {
    flex: 1,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 58, 138, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  activeTimeRangeButton: {
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderColor: 'rgba(0, 255, 136, 0.5)',
  },
  timeRangeText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTimeRangeText: {
    color: '#00FF88',
  },
  lastUpdateContainer: {
    alignItems: 'flex-end',
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  currentTimeText: {
    fontSize: 14,
    color: '#60A5FA',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    padding: 24,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  metricCard: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  metricCardGradient: {
    padding: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  metricStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  trendIcon: {
    marginLeft: 4,
  },
  metricValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  metricNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F8FAFC',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  metricUnit: {
    fontSize: 16,
    color: '#60A5FA',
    marginLeft: 4,
    fontWeight: '600',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    justifyContent: 'space-between',
  },
  trendBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 4,
  },
  actionsSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginLeft: 8,
  },
});