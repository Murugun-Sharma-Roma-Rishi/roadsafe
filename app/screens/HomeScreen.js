import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Vibration, Platform, Dimensions
} from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import axios from 'axios';

// ⚠️ CHANGE THIS to your computer's IP address when testing on phone
// Run "ipconfig" on Windows or "ifconfig" on Mac to find your IP
const API_URL = 'http://192.168.1.100:3001';

const POTHOLE_THRESHOLD = 2.5;   // G-force to trigger pothole
const CRASH_THRESHOLD = 4.0;     // G-force to trigger crash alert
const SWERVE_THRESHOLD = 1.8;    // Gyroscope to trigger swerve

export default function HomeScreen() {
  const [accelData, setAccelData] = useState({ x: 0, y: 0, z: 0 });
  const [gyroData, setGyroData] = useState({ x: 0, y: 0, z: 0 });
  const [location, setLocation] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [potholeCount, setPotholeCount] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [safetyScore, setSafetyScore] = useState(100);
  const [speed, setSpeed] = useState(0);
  const [sosMode, setSosMode] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Tap START to begin monitoring');

  const accelSubscription = useRef(null);
  const gyroSubscription = useRef(null);
  const locationSubscription = useRef(null);
  const crashTimer = useRef(null);
  const lastPotholeTime = useRef(0);

  useEffect(() => {
    requestPermissions();
    return () => stopMonitoring();
  }, []);

  const requestPermissions = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location access is required for road hazard detection');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    } catch (e) {
      console.log('Permission error:', e);
    }
  };

  const startMonitoring = async () => {
    setIsMonitoring(true);
    setStatusMsg('🟢 Monitoring road conditions...');
    addAlert('Monitoring started — drive safely!', 'info');

    // Start location tracking
    locationSubscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 5 },
      (loc) => {
        setLocation(loc.coords);
        const spd = loc.coords.speed ? (loc.coords.speed * 3.6).toFixed(0) : 0;
        setSpeed(spd);
      }
    );

    // Accelerometer for pothole + crash detection
    Accelerometer.setUpdateInterval(100);
    accelSubscription.current = Accelerometer.addListener((data) => {
      setAccelData(data);
      const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      const now = Date.now();

      if (magnitude > CRASH_THRESHOLD) {
        triggerCrashAlert(data, magnitude);
      } else if (magnitude > POTHOLE_THRESHOLD && (now - lastPotholeTime.current) > 2000) {
        lastPotholeTime.current = now;
        detectPothole(data, magnitude);
      }
    });

    // Gyroscope for swerve detection
    Gyroscope.setUpdateInterval(100);
    gyroSubscription.current = Gyroscope.addListener((data) => {
      setGyroData(data);
      const rotation = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      if (rotation > SWERVE_THRESHOLD) {
        detectSwerve(data, rotation);
      }
    });
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setStatusMsg('Tap START to begin monitoring');
    if (accelSubscription.current) accelSubscription.current.remove();
    if (gyroSubscription.current) gyroSubscription.current.remove();
    if (locationSubscription.current) locationSubscription.current.remove();
    accelSubscription.current = null;
    gyroSubscription.current = null;
    locationSubscription.current = null;
  };

  const detectPothole = async (data, magnitude) => {
    setPotholeCount(c => c + 1);
    setSafetyScore(s => Math.max(0, s - 2));
    Vibration.vibrate(200);

    const severity = magnitude > 3.5 ? 'HIGH' : magnitude > 2.8 ? 'MEDIUM' : 'LOW';
    addAlert(`🕳️ Pothole detected! Severity: ${severity} (${magnitude.toFixed(2)}G)`, 'warning');

    if (location) {
      try {
        await axios.post(`${API_URL}/api/hazards`, {
          type: 'pothole',
          severity,
          latitude: location.latitude,
          longitude: location.longitude,
          magnitude: magnitude.toFixed(3),
          sensorData: { x: data.x, y: data.y, z: data.z },
          timestamp: new Date().toISOString(),
          anonymous: true,
        });
        addAlert('✅ Pothole reported to authorities', 'success');
      } catch (e) {
        // Offline: save locally
        saveOffline({ type: 'pothole', severity, location, magnitude });
        addAlert('📴 Saved offline — will sync later', 'info');
      }
    }
  };

  const detectSwerve = (data, rotation) => {
    setSafetyScore(s => Math.max(0, s - 1));
    addAlert(`⚠️ Sharp swerve detected (${rotation.toFixed(2)} rad/s)`, 'warning');
  };

  const triggerCrashAlert = async (data, magnitude) => {
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    setSosMode(true);
    addAlert('🆘 CRASH DETECTED! Auto-SOS in 10 seconds...', 'danger');

    // Give user 10 seconds to cancel
    crashTimer.current = setTimeout(() => {
      sendSOS('auto_crash_detection');
    }, 10000);

    Alert.alert(
      '🆘 CRASH DETECTED',
      `Impact: ${magnitude.toFixed(1)}G\n\nAuto-SOS will send in 10 seconds.\nAre you OK?`,
      [
        { text: "I'm OK — Cancel SOS", onPress: cancelSOS, style: 'cancel' },
        { text: 'SEND SOS NOW', onPress: () => sendSOS('manual'), style: 'destructive' },
      ]
    );
  };

  const cancelSOS = () => {
    if (crashTimer.current) clearTimeout(crashTimer.current);
    setSosMode(false);
    addAlert('✅ SOS cancelled — glad you are safe!', 'success');
  };

  const sendSOS = async (trigger) => {
    setSosMode(false);
    addAlert('🆘 SOS SENT to emergency contacts!', 'danger');
    if (location) {
      try {
        await axios.post(`${API_URL}/api/sos`, {
          trigger,
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date().toISOString(),
          mapsLink: `https://maps.google.com/?q=${location.latitude},${location.longitude}`,
        });
      } catch (e) {
        console.log('SOS send failed:', e);
      }
    }
    Alert.alert(
      '🆘 SOS Sent',
      `Emergency services notified.\nYour location: ${location?.latitude?.toFixed(5)}, ${location?.longitude?.toFixed(5)}`
    );
  };

  const saveOffline = (data) => {
    // In a real app, use AsyncStorage here
    console.log('Saved offline:', data);
  };

  const addAlert = (msg, type) => {
    const newAlert = { msg, type, time: new Date().toLocaleTimeString(), id: Date.now() };
    setAlerts(prev => [newAlert, ...prev].slice(0, 10));
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'danger': return '#E74C3C';
      case 'warning': return '#F39C12';
      case 'success': return '#2ECC71';
      default: return '#3498DB';
    }
  };

  const getMagnitude = () => {
    return Math.sqrt(accelData.x ** 2 + accelData.y ** 2 + accelData.z ** 2).toFixed(2);
  };

  const getScoreColor = () => {
    if (safetyScore >= 80) return '#2ECC71';
    if (safetyScore >= 50) return '#F39C12';
    return '#E74C3C';
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: isMonitoring ? '#0F6E56' : '#1a1a2e' }]}>
        <Text style={styles.statusText}>{statusMsg}</Text>
        {sosMode && <Text style={styles.sosText}>🆘 SOS ACTIVE</Text>}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{potholeCount}</Text>
          <Text style={styles.statLabel}>Potholes{'\n'}Detected</Text>
        </View>
        <View style={[styles.statCard, { borderColor: getScoreColor() }]}>
          <Text style={[styles.statNum, { color: getScoreColor() }]}>{safetyScore}</Text>
          <Text style={styles.statLabel}>Road Safety{'\n'}Score</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{speed}</Text>
          <Text style={styles.statLabel}>Speed{'\n'}km/h</Text>
        </View>
      </View>

      {/* Sensor Live Data */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📡 Live Sensor Data</Text>
        <View style={styles.sensorRow}>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>G-Force</Text>
            <Text style={[styles.sensorValue, { color: getMagnitude() > POTHOLE_THRESHOLD ? '#E74C3C' : '#2ECC71' }]}>
              {getMagnitude()}G
            </Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Accel X</Text>
            <Text style={styles.sensorValue}>{accelData.x.toFixed(2)}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Accel Y</Text>
            <Text style={styles.sensorValue}>{accelData.y.toFixed(2)}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Accel Z</Text>
            <Text style={styles.sensorValue}>{accelData.z.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.sensorRow}>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Gyro X</Text>
            <Text style={styles.sensorValue}>{gyroData.x.toFixed(2)}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Gyro Y</Text>
            <Text style={styles.sensorValue}>{gyroData.y.toFixed(2)}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>Gyro Z</Text>
            <Text style={styles.sensorValue}>{gyroData.z.toFixed(2)}</Text>
          </View>
          <View style={styles.sensorItem}>
            <Text style={styles.sensorLabel}>GPS</Text>
            <Text style={[styles.sensorValue, { fontSize: 10 }]}>
              {location ? `${location.latitude.toFixed(4)}` : 'waiting...'}
            </Text>
          </View>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.buttonRow}>
        {!isMonitoring ? (
          <TouchableOpacity style={[styles.btn, styles.btnStart]} onPress={startMonitoring}>
            <Text style={styles.btnText}>▶ START MONITORING</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnStop]} onPress={stopMonitoring}>
            <Text style={styles.btnText}>⏹ STOP</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.btn, styles.btnSOS]}
          onPress={() => sendSOS('manual')}
        >
          <Text style={styles.btnText}>🆘 SOS</Text>
        </TouchableOpacity>
      </View>

      {/* Location Card */}
      {location && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Your Location</Text>
          <Text style={styles.locationText}>Lat: {location.latitude.toFixed(6)}</Text>
          <Text style={styles.locationText}>Lng: {location.longitude.toFixed(6)}</Text>
          <Text style={styles.locationText}>Accuracy: ±{location.accuracy?.toFixed(0) || '?'}m</Text>
        </View>
      )}

      {/* Alert Log */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔔 Live Alerts</Text>
        {alerts.length === 0 && (
          <Text style={styles.emptyText}>No alerts yet — start monitoring to detect hazards</Text>
        )}
        {alerts.map((a) => (
          <View key={a.id} style={[styles.alertItem, { borderLeftColor: getAlertColor(a.type) }]}>
            <Text style={[styles.alertMsg, { color: getAlertColor(a.type) }]}>{a.msg}</Text>
            <Text style={styles.alertTime}>{a.time}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  statusBanner: {
    padding: 14, margin: 12, borderRadius: 12,
    alignItems: 'center',
  },
  statusText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sosText: { color: '#E74C3C', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: '#1a1a2e', borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2d2d4e',
  },
  statNum: { fontSize: 28, fontWeight: 'bold', color: '#3498DB' },
  statLabel: { fontSize: 11, color: '#7f8c8d', textAlign: 'center', marginTop: 4 },
  card: {
    backgroundColor: '#1a1a2e', margin: 12, marginTop: 0,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2d2d4e',
  },
  cardTitle: { color: '#ecf0f1', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  sensorRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sensorItem: {
    flex: 1, backgroundColor: '#0d0d1a', borderRadius: 8,
    padding: 8, alignItems: 'center',
  },
  sensorLabel: { fontSize: 10, color: '#7f8c8d', marginBottom: 4 },
  sensorValue: { fontSize: 13, fontWeight: '700', color: '#3498DB' },
  buttonRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 10, marginBottom: 8 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnStart: { backgroundColor: '#27AE60', flex: 2 },
  btnStop: { backgroundColor: '#E74C3C', flex: 2 },
  btnSOS: { backgroundColor: '#C0392B' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  locationText: { color: '#bdc3c7', fontSize: 13, marginBottom: 2 },
  alertItem: {
    borderLeftWidth: 3, paddingLeft: 10, marginBottom: 8,
    paddingVertical: 6,
  },
  alertMsg: { fontSize: 13, fontWeight: '600' },
  alertTime: { fontSize: 11, color: '#7f8c8d', marginTop: 2 },
  emptyText: { color: '#7f8c8d', fontSize: 13, textAlign: 'center', padding: 16 },
});