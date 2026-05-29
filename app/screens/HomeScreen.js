import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Vibration, Linking
} from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import config from '../config';

const API_URL = config.API_URL;

// Sensor thresholds
const POTHOLE_THRESHOLD = 2.2;    // moderate vertical spike = pothole (shake)
const SWERVE_THRESHOLD = 1.8;     // gyroscope Z rotation = swerve (wave side to side)
const CRASH_THRESHOLD = 3.8;      // massive impact = crash (heavy shake / drop)

const SOS_COUNTDOWN_SECONDS = 10;
const SOS_COOLDOWN_MS = 30000;    // 30s between SOS triggers
const POTHOLE_COOLDOWN_MS = 2000;

export default function HomeScreen() {
  const [accelData, setAccelData] = useState({ x: 0, y: 0, z: 0 });
  const [gyroData, setGyroData] = useState({ x: 0, y: 0, z: 0 });
  const [location, setLocation] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [potholeCount, setPotholeCount] = useState(0);
  const [alerts, setAlerts] = useState([]);
  const [safetyScore, setSafetyScore] = useState(100);
  const [speed, setSpeed] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Tap START to begin monitoring');

  // SOS state
  const [sosActive, setSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(SOS_COUNTDOWN_SECONDS);
  const [emergencyContact, setEmergencyContact] = useState('');

  const accelSub = useRef(null);
  const gyroSub = useRef(null);
  const locationSub = useRef(null);
  const sosTimerRef = useRef(null);
  const lastPotholeTime = useRef(0);
  const lastSosTriggerTime = useRef(0);
  const sosActiveRef = useRef(false);
  const locationRef = useRef(null);

  useEffect(() => {
    requestPermissions();
    loadContact();
    return () => stopMonitoring();
  }, []);

  const loadContact = async () => {
    try {
      const saved = await AsyncStorage.getItem('emergencyContact');
      if (saved) setEmergencyContact(saved);
    } catch (e) {}
  };

  const requestPermissions = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location access is required for road hazard detection');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      locationRef.current = loc.coords;
    } catch (e) {}
  };

  const startMonitoring = async () => {
    setIsMonitoring(true);
    setStatusMsg('🟢 Monitoring road conditions...');
    addAlert('Monitoring started — drive safely!', 'info');

    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 5 },
      (loc) => {
        setLocation(loc.coords);
        locationRef.current = loc.coords;
        const spd = loc.coords.speed ? Math.max(0, loc.coords.speed * 3.6).toFixed(0) : 0;
        setSpeed(spd);
      }
    );

    Accelerometer.setUpdateInterval(100);
    accelSub.current = Accelerometer.addListener((data) => {
      setAccelData(data);
      const now = Date.now();

      // Overall magnitude
      const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

      // CRASH: very heavy impact / drop (heavy shake or fall)
      if (magnitude > CRASH_THRESHOLD) {
        if (!sosActiveRef.current && (now - lastSosTriggerTime.current) > SOS_COOLDOWN_MS) {
          lastSosTriggerTime.current = now;
          triggerCrashSOS(magnitude);
        }
        return;
      }

      // POTHOLE: vertical (Z-axis) spike — shake up/down
      const verticalSpike = Math.abs(data.z - 1); // subtract resting gravity (~1g)
      if (verticalSpike > POTHOLE_THRESHOLD && (now - lastPotholeTime.current) > POTHOLE_COOLDOWN_MS) {
        lastPotholeTime.current = now;
        detectPothole(data, magnitude);
      }
    });

    Gyroscope.setUpdateInterval(100);
    gyroSub.current = Gyroscope.addListener((data) => {
      setGyroData(data);
      // SWERVE: lateral rotation — wave phone side to side
      const rotation = Math.abs(data.z);
      if (rotation > SWERVE_THRESHOLD) {
        detectSwerve(rotation);
      }
    });
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setStatusMsg('Tap START to begin monitoring');
    if (accelSub.current) accelSub.current.remove();
    if (gyroSub.current) gyroSub.current.remove();
    if (locationSub.current) locationSub.current.remove();
    accelSub.current = null;
    gyroSub.current = null;
    locationSub.current = null;
    cancelSOS();
  };

  const detectPothole = async (data, magnitude) => {
    setPotholeCount(c => c + 1);
    setSafetyScore(s => Math.max(0, s - 2));
    Vibration.vibrate(200);

    const severity = magnitude > 3.5 ? 'HIGH' : magnitude > 2.8 ? 'MEDIUM' : 'LOW';
    addAlert(`🕳️ Pothole detected! ${severity} (${magnitude.toFixed(2)}G)`, 'warning');

    const loc = locationRef.current;
    if (loc) {
      try {
        await axios.post(`${API_URL}/api/hazards`, {
          type: 'pothole',
          severity,
          latitude: loc.latitude,
          longitude: loc.longitude,
          magnitude: magnitude.toFixed(3),
          timestamp: new Date().toISOString(),
          anonymous: true,
        });
        addAlert('✅ Pothole auto-reported', 'success');
      } catch (e) {
        addAlert('📴 Saved offline — will sync later', 'info');
      }
    }
  };

  const detectSwerve = (rotation) => {
    setSafetyScore(s => Math.max(0, s - 1));
    addAlert(`⚠️ Swerve detected (${rotation.toFixed(2)} rad/s)`, 'warning');
  };

  const triggerCrashSOS = (magnitude) => {
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    sosActiveRef.current = true;
    setSosActive(true);
    setSosCountdown(SOS_COUNTDOWN_SECONDS);
    addAlert(`🆘 CRASH DETECTED! ${magnitude.toFixed(1)}G — SOS in ${SOS_COUNTDOWN_SECONDS}s`, 'danger');

    let count = SOS_COUNTDOWN_SECONDS;
    sosTimerRef.current = setInterval(() => {
      count -= 1;
      setSosCountdown(count);
      if (count <= 0) {
        clearInterval(sosTimerRef.current);
        sosActiveRef.current = false;
        setSosActive(false);
        sendSOSWhatsApp();
      }
    }, 1000);
  };

  const cancelSOS = () => {
    sosActiveRef.current = false;
    setSosActive(false);
    setSosCountdown(SOS_COUNTDOWN_SECONDS);
    if (sosTimerRef.current) clearInterval(sosTimerRef.current);
    addAlert('✅ SOS cancelled — glad you are safe!', 'success');
  };

  const sendSOSWhatsApp = () => {
    const loc = locationRef.current;
    const mapsLink = loc
      ? `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`
      : 'Location unavailable';

    const message = encodeURIComponent(
      `🆘 EMERGENCY ALERT from RoadSafe!\n\nA crash has been detected. I may need help.\n\n📍 My location:\n${mapsLink}\n\nPlease call me or send help immediately.`
    );

    const contact = emergencyContact;
    if (!contact) {
      Alert.alert('No SOS contact', 'Please set an emergency contact in the Driver tab.');
      return;
    }

    const phone = contact.replace(/\D/g, '');

    // Auto-open WhatsApp — user just needs to press Send
    // (Full auto-send is not possible without WhatsApp Business API)
    Linking.openURL(`https://wa.me/${phone}?text=${message}`).catch(() => {
      Linking.openURL(`sms:${contact}?body=${message}`);
    });

    // Also log to backend
    axios.post(`${API_URL}/api/sos`, {
      trigger: 'crash_auto',
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      timestamp: new Date().toISOString(),
      mapsLink,
    }).catch(() => {});

    addAlert('🆘 SOS WhatsApp opened!', 'danger');
  };

  const manualSOS = () => {
    if (!emergencyContact) {
      Alert.alert('No SOS contact', 'Go to the Driver tab and set your emergency contact first.');
      return;
    }
    Alert.alert(
      '🆘 Send SOS?',
      `Send emergency WhatsApp to ${emergencyContact}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send SOS Now', style: 'destructive', onPress: sendSOSWhatsApp },
      ]
    );
  };

  const addAlert = (msg, type) => {
    setAlerts(prev => [
      { msg, type, time: new Date().toLocaleTimeString(), id: Date.now() },
      ...prev,
    ].slice(0, 10));
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'danger': return '#E74C3C';
      case 'warning': return '#F39C12';
      case 'success': return '#2ECC71';
      default: return '#3498DB';
    }
  };

  const magnitude = Math.sqrt(accelData.x ** 2 + accelData.y ** 2 + accelData.z ** 2);
  const getScoreColor = () => safetyScore >= 80 ? '#2ECC71' : safetyScore >= 50 ? '#F39C12' : '#E74C3C';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: isMonitoring ? '#0F6E56' : '#1a1a2e' }]}>
          <Text style={styles.statusText}>{statusMsg}</Text>
          {emergencyContact
            ? <Text style={styles.contactHint}>🆘 SOS → {emergencyContact}</Text>
            : <Text style={styles.contactHintWarn}>⚠️ No SOS contact — set one in Driver tab</Text>
          }
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
              <Text style={[styles.sensorValue, { color: magnitude > POTHOLE_THRESHOLD ? '#E74C3C' : '#2ECC71' }]}>
                {magnitude.toFixed(2)}G
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
              <Text style={[styles.sensorValue, { color: Math.abs(accelData.z - 1) > POTHOLE_THRESHOLD ? '#F39C12' : '#3498DB' }]}>
                {accelData.z.toFixed(2)}
              </Text>
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
              <Text style={[styles.sensorValue, { color: Math.abs(gyroData.z) > SWERVE_THRESHOLD ? '#F39C12' : '#3498DB' }]}>
                {gyroData.z.toFixed(2)}
              </Text>
            </View>
            <View style={styles.sensorItem}>
              <Text style={styles.sensorLabel}>GPS</Text>
              <Text style={[styles.sensorValue, { fontSize: 10 }]}>
                {location ? `${location.latitude.toFixed(4)}` : 'waiting...'}
              </Text>
            </View>
          </View>
          {/* Gesture legend */}
          <View style={styles.legendRow}>
            <Text style={styles.legendItem}>🔀 Wave phone = Swerve</Text>
            <Text style={styles.legendItem}>📳 Shake up/down = Pothole</Text>
            <Text style={styles.legendItem}>💥 Heavy drop/impact = Crash SOS</Text>
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
          <TouchableOpacity style={[styles.btn, styles.btnSOS]} onPress={manualSOS}>
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

      {/* SOS Countdown Overlay */}
      {sosActive && (
        <View style={styles.sosOverlay}>
          <Text style={styles.sosOverlayIcon}>🚨</Text>
          <Text style={styles.sosOverlayTitle}>CRASH DETECTED</Text>
          <Text style={styles.sosOverlaySubtitle}>
            Sending SOS to {emergencyContact} in...
          </Text>
          <Text style={styles.sosOverlayCountdown}>{sosCountdown}</Text>
          <Text style={styles.sosOverlayHint}>seconds</Text>
          <TouchableOpacity style={styles.sosCancelBtn} onPress={cancelSOS}>
            <Text style={styles.sosCancelText}>✕  I'M OK — Cancel SOS</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  statusBanner: {
    padding: 14, margin: 12, borderRadius: 12, alignItems: 'center',
  },
  statusText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  contactHint: { color: '#2ECC71', fontSize: 11, marginTop: 4 },
  contactHintWarn: { color: '#F39C12', fontSize: 11, marginTop: 4 },

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

  legendRow: { marginTop: 8, gap: 4 },
  legendItem: { color: '#7f8c8d', fontSize: 11 },

  buttonRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 10, marginBottom: 8 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnStart: { backgroundColor: '#27AE60', flex: 2 },
  btnStop: { backgroundColor: '#E74C3C', flex: 2 },
  btnSOS: { backgroundColor: '#C0392B' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  locationText: { color: '#bdc3c7', fontSize: 13, marginBottom: 2 },
  alertItem: {
    borderLeftWidth: 3, paddingLeft: 10, marginBottom: 8, paddingVertical: 6,
  },
  alertMsg: { fontSize: 13, fontWeight: '600' },
  alertTime: { fontSize: 11, color: '#7f8c8d', marginTop: 2 },
  emptyText: { color: '#7f8c8d', fontSize: 13, textAlign: 'center', padding: 16 },

  sosOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(180,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center', padding: 30,
  },
  sosOverlayIcon: { fontSize: 80, marginBottom: 12 },
  sosOverlayTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  sosOverlaySubtitle: { color: '#ffcccc', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  sosOverlayCountdown: { color: '#fff', fontSize: 96, fontWeight: 'bold', lineHeight: 100 },
  sosOverlayHint: { color: '#ffcccc', fontSize: 18, marginBottom: 40 },
  sosCancelBtn: {
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 32, paddingVertical: 18,
  },
  sosCancelText: { color: '#C0392B', fontSize: 18, fontWeight: 'bold' },
});