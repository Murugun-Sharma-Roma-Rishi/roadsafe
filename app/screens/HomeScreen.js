import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Vibration, Linking, Animated,
} from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import config from '../config';

const API_URL = config.API_URL;

const POTHOLE_THRESHOLD  = 2.2;
const SWERVE_THRESHOLD   = 1.8;
const CRASH_THRESHOLD    = 3.8;
const SOS_COUNTDOWN_SECONDS = 10;
const SOS_COOLDOWN_MS    = 30000;
const POTHOLE_COOLDOWN_MS = 2000;

export default function HomeScreen() {
  const [accelData,  setAccelData]  = useState({ x: 0, y: 0, z: 0 });
  const [gyroData,   setGyroData]   = useState({ x: 0, y: 0, z: 0 });
  const [location,   setLocation]   = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [potholeCount, setPotholeCount] = useState(0);
  const [alerts,     setAlerts]     = useState([]);
  const [safetyScore, setSafetyScore] = useState(100);
  const [speed,      setSpeed]      = useState(0);
  const [statusMsg,  setStatusMsg]  = useState('Tap START to begin monitoring');
  const [showSensors, setShowSensors] = useState(false);

  const [sosActive,   setSosActive]   = useState(false);
  const [sosCountdown, setSosCountdown] = useState(SOS_COUNTDOWN_SECONDS);
  const [emergencyContact, setEmergencyContact] = useState('');

  const accelSub  = useRef(null);
  const gyroSub   = useRef(null);
  const locationSub = useRef(null);
  const sosTimerRef = useRef(null);
  const lastPotholeTime = useRef(0);
  const lastSosTriggerTime = useRef(0);
  const sosActiveRef = useRef(false);
  const locationRef  = useRef(null);
  const pulseAnim    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    requestPermissions();
    loadContact();
    return () => stopMonitoring();
  }, []);

  useEffect(() => {
    if (isMonitoring) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.00, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isMonitoring]);

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
        Alert.alert('Permission needed', 'Location is required for road hazard detection.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      locationRef.current = loc.coords;
    } catch (e) {}
  };

  const startMonitoring = async () => {
    setIsMonitoring(true);
    setStatusMsg('🟢 Monitoring active');
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
      const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

      if (magnitude > CRASH_THRESHOLD) {
        if (!sosActiveRef.current && (now - lastSosTriggerTime.current) > SOS_COOLDOWN_MS) {
          lastSosTriggerTime.current = now;
          triggerCrashSOS(magnitude);
        }
        return;
      }

      const verticalSpike = Math.abs(data.z - 1);
      if (verticalSpike > POTHOLE_THRESHOLD && (now - lastPotholeTime.current) > POTHOLE_COOLDOWN_MS) {
        lastPotholeTime.current = now;
        detectPothole(data, magnitude);
      }
    });

    Gyroscope.setUpdateInterval(100);
    gyroSub.current = Gyroscope.addListener((data) => {
      setGyroData(data);
      if (Math.abs(data.z) > SWERVE_THRESHOLD) detectSwerve(data.z);
    });
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setStatusMsg('Tap START to begin monitoring');
    accelSub.current?.remove();
    gyroSub.current?.remove();
    locationSub.current?.remove();
    accelSub.current = gyroSub.current = locationSub.current = null;
    cancelSOS();
  };

  const detectPothole = async (data, magnitude) => {
    setPotholeCount(c => c + 1);
    setSafetyScore(s => Math.max(0, s - 2));
    Vibration.vibrate(200);
    const severity = magnitude > 3.5 ? 'HIGH' : magnitude > 2.8 ? 'MEDIUM' : 'LOW';
    addAlert(`🕳️ Pothole detected — ${severity} severity`, 'warning');
    const loc = locationRef.current;
    if (loc) {
      try {
        await axios.post(`${API_URL}/api/hazards`, {
          type: 'pothole', severity,
          latitude: loc.latitude, longitude: loc.longitude,
          magnitude: magnitude.toFixed(3),
          timestamp: new Date().toISOString(), anonymous: true,
        });
        addAlert('✅ Pothole auto-reported', 'success');
      } catch (e) {
        addAlert('📴 Saved offline — syncs when online', 'info');
      }
    }
  };

  const detectSwerve = (rotation) => {
    setSafetyScore(s => Math.max(0, s - 1));
    addAlert(`⚠️ Swerve detected (${Math.abs(rotation).toFixed(1)} rad/s)`, 'warning');
  };

  const triggerCrashSOS = (magnitude) => {
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    sosActiveRef.current = true;
    setSosActive(true);
    setSosCountdown(SOS_COUNTDOWN_SECONDS);
    addAlert(`🆘 CRASH DETECTED! SOS in ${SOS_COUNTDOWN_SECONDS}s`, 'danger');
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
    const mapsLink = loc ? `https://maps.google.com/?q=${loc.latitude},${loc.longitude}` : 'Location unavailable';
    const message = encodeURIComponent(`🆘 EMERGENCY from RoadSafe!\n\nCrash detected. I may need help.\n\n📍 Location:\n${mapsLink}\n\nPlease call me or send help immediately.`);
    if (!emergencyContact) {
      Alert.alert('No SOS contact', 'Please set an emergency contact in the Driver tab.');
      return;
    }
    const phone = emergencyContact.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${phone}?text=${message}`).catch(() => {
      Linking.openURL(`sms:${emergencyContact}?body=${message}`);
    });
    axios.post(`${API_URL}/api/sos`, { trigger: 'crash_auto', latitude: loc?.latitude, longitude: loc?.longitude, timestamp: new Date().toISOString(), mapsLink }).catch(() => {});
    addAlert('🆘 SOS WhatsApp opened!', 'danger');
  };

  const manualSOS = () => {
    if (!emergencyContact) {
      Alert.alert('No SOS contact', 'Set an emergency contact in the Driver tab first.');
      return;
    }
    Alert.alert('🆘 Send SOS?', `Send emergency WhatsApp to ${emergencyContact}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send SOS Now', style: 'destructive', onPress: sendSOSWhatsApp },
    ]);
  };

  const addAlert = (msg, type) => {
    setAlerts(prev => [
      { msg, type, time: new Date().toLocaleTimeString(), id: Date.now() },
      ...prev,
    ].slice(0, 8));
  };

  const getAlertColor = (type) => ({ danger: '#E74C3C', warning: '#F39C12', success: '#2ECC71', info: '#3498DB' }[type] || '#3498DB');
  const getScoreColor = () => safetyScore >= 80 ? '#2ECC71' : safetyScore >= 50 ? '#F39C12' : '#E74C3C';
  const magnitude = Math.sqrt(accelData.x ** 2 + accelData.y ** 2 + accelData.z ** 2);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: isMonitoring ? '#0d3d2b' : '#1a1a2e', borderColor: isMonitoring ? '#2ECC71' : '#2d2d4e' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Animated.View style={[styles.statusDot, { backgroundColor: isMonitoring ? '#2ECC71' : '#7f8c8d', transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.statusText}>{statusMsg}</Text>
          </View>
          {emergencyContact
            ? <Text style={styles.contactHint}>🆘 SOS → {emergencyContact}</Text>
            : <Text style={styles.contactHintWarn}>⚠️ No SOS contact — set one in Driver tab</Text>
          }
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{potholeCount}</Text>
            <Text style={styles.statLabel}>Potholes</Text>
          </View>
          <View style={[styles.statCard, { borderColor: getScoreColor(), borderWidth: 2 }]}>
            <Text style={[styles.statNum, { color: getScoreColor() }]}>{safetyScore}</Text>
            <Text style={styles.statLabel}>Safety Score</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: speed > 0 ? '#3498DB' : '#7f8c8d' }]}>{speed}</Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
        </View>

        {/* Control Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.btn, isMonitoring ? styles.btnStop : styles.btnStart]}
            onPress={isMonitoring ? stopMonitoring : startMonitoring}
          >
            <Text style={styles.btnText}>{isMonitoring ? '⏹  STOP' : '▶  START MONITORING'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnSOS]} onPress={manualSOS}>
            <Text style={styles.btnText}>🆘</Text>
          </TouchableOpacity>
        </View>

        {/* G-Force indicator */}
        <View style={styles.card}>
          <View style={styles.gforceRow}>
            <View style={styles.gforceItem}>
              <Text style={styles.gforceLabel}>G-Force</Text>
              <Text style={[styles.gforceValue, { color: magnitude > POTHOLE_THRESHOLD ? '#E74C3C' : '#2ECC71' }]}>
                {magnitude.toFixed(2)}G
              </Text>
            </View>
            <View style={styles.gforceItem}>
              <Text style={styles.gforceLabel}>Vertical</Text>
              <Text style={[styles.gforceValue, { color: Math.abs(accelData.z - 1) > POTHOLE_THRESHOLD ? '#F39C12' : '#3498DB' }]}>
                {accelData.z.toFixed(2)}
              </Text>
            </View>
            <View style={styles.gforceItem}>
              <Text style={styles.gforceLabel}>Rotation</Text>
              <Text style={[styles.gforceValue, { color: Math.abs(gyroData.z) > SWERVE_THRESHOLD ? '#F39C12' : '#3498DB' }]}>
                {Math.abs(gyroData.z).toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowSensors(v => !v)} style={styles.expandBtn}>
              <Text style={styles.expandBtnText}>{showSensors ? '▲' : '▼'}</Text>
              <Text style={styles.expandBtnLabel}>Raw</Text>
            </TouchableOpacity>
          </View>

          {/* Expandable raw sensor data */}
          {showSensors && (
            <View style={styles.rawSensors}>
              <View style={styles.rawRow}>
                {['X', 'Y', 'Z'].map(axis => (
                  <View key={axis} style={styles.rawItem}>
                    <Text style={styles.rawLabel}>Accel {axis}</Text>
                    <Text style={styles.rawValue}>{accelData[axis.toLowerCase()]?.toFixed(2) ?? '0.00'}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.rawRow}>
                {['X', 'Y', 'Z'].map(axis => (
                  <View key={axis} style={styles.rawItem}>
                    <Text style={styles.rawLabel}>Gyro {axis}</Text>
                    <Text style={styles.rawValue}>{gyroData[axis.toLowerCase()]?.toFixed(2) ?? '0.00'}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.legendRow}>
                <Text style={styles.legendItem}>📳 Shake up/down = Pothole</Text>
                <Text style={styles.legendItem}>🔀 Wave sideways = Swerve</Text>
                <Text style={styles.legendItem}>💥 Hard impact = Crash SOS</Text>
              </View>
            </View>
          )}
        </View>

        {/* Location */}
        {location && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📍 Location</Text>
            <View style={styles.locationRow}>
              <Text style={styles.locationText}>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</Text>
              <Text style={styles.locationAccuracy}>±{location.accuracy?.toFixed(0) || '?'}m</Text>
            </View>
          </View>
        )}

        {/* Alert Log */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔔 Live Alerts</Text>
          {alerts.length === 0
            ? <Text style={styles.emptyText}>No alerts yet</Text>
            : alerts.map(a => (
              <View key={a.id} style={[styles.alertItem, { borderLeftColor: getAlertColor(a.type) }]}>
                <Text style={[styles.alertMsg, { color: getAlertColor(a.type) }]}>{a.msg}</Text>
                <Text style={styles.alertTime}>{a.time}</Text>
              </View>
            ))
          }
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* SOS Overlay */}
      {sosActive && (
        <View style={styles.sosOverlay}>
          <Text style={styles.sosOverlayIcon}>🚨</Text>
          <Text style={styles.sosOverlayTitle}>CRASH DETECTED</Text>
          <Text style={styles.sosOverlaySubtitle}>Sending SOS to{'\n'}{emergencyContact}</Text>
          <Text style={styles.sosOverlayCountdown}>{sosCountdown}</Text>
          <Text style={styles.sosOverlayHint}>seconds</Text>
          <TouchableOpacity style={styles.sosCancelBtn} onPress={cancelSOS}>
            <Text style={styles.sosCancelText}>✕  I'M OK — Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },

  statusBanner: { margin: 12, borderRadius: 14, padding: 14, borderWidth: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  contactHint: { color: '#2ECC71', fontSize: 11, marginTop: 6 },
  contactHintWarn: { color: '#F39C12', fontSize: 11, marginTop: 6 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2d2d4e' },
  statNum: { fontSize: 30, fontWeight: 'bold', color: '#3498DB' },
  statLabel: { fontSize: 11, color: '#7f8c8d', marginTop: 4, textAlign: 'center' },

  buttonRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 10, marginBottom: 10 },
  btn: { flex: 1, padding: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnStart: { backgroundColor: '#27AE60', flex: 3 },
  btnStop:  { backgroundColor: '#E74C3C', flex: 3 },
  btnSOS:   { backgroundColor: '#C0392B', flex: 1, borderWidth: 2, borderColor: '#E74C3C' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  card: { backgroundColor: '#1a1a2e', marginHorizontal: 12, marginBottom: 10, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2d2d4e' },
  cardTitle: { color: '#ecf0f1', fontSize: 14, fontWeight: '700', marginBottom: 10 },

  gforceRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  gforceItem: { flex: 1, alignItems: 'center' },
  gforceLabel: { fontSize: 10, color: '#7f8c8d', marginBottom: 4 },
  gforceValue: { fontSize: 18, fontWeight: '700' },
  expandBtn: { alignItems: 'center', paddingHorizontal: 12 },
  expandBtnText: { color: '#7f8c8d', fontSize: 16 },
  expandBtnLabel: { color: '#7f8c8d', fontSize: 9, marginTop: 2 },

  rawSensors: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#2d2d4e', paddingTop: 10 },
  rawRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  rawItem: { flex: 1, backgroundColor: '#0d0d1a', borderRadius: 8, padding: 8, alignItems: 'center' },
  rawLabel: { fontSize: 10, color: '#7f8c8d', marginBottom: 3 },
  rawValue: { fontSize: 13, fontWeight: '700', color: '#3498DB' },
  legendRow: { gap: 3, marginTop: 4 },
  legendItem: { color: '#7f8c8d', fontSize: 11 },

  locationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationText: { color: '#bdc3c7', fontSize: 12, fontFamily: 'monospace' },
  locationAccuracy: { color: '#7f8c8d', fontSize: 11 },

  alertItem: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 8, paddingVertical: 5 },
  alertMsg: { fontSize: 13, fontWeight: '600' },
  alertTime: { fontSize: 10, color: '#7f8c8d', marginTop: 2 },
  emptyText: { color: '#7f8c8d', fontSize: 13, textAlign: 'center', paddingVertical: 10 },

  sosOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(180,0,0,0.96)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  sosOverlayIcon: { fontSize: 80, marginBottom: 12 },
  sosOverlayTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  sosOverlaySubtitle: { color: '#ffcccc', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  sosOverlayCountdown: { color: '#fff', fontSize: 100, fontWeight: 'bold', lineHeight: 110 },
  sosOverlayHint: { color: '#ffcccc', fontSize: 18, marginBottom: 40 },
  sosCancelBtn: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 36, paddingVertical: 18 },
  sosCancelText: { color: '#C0392B', fontSize: 18, fontWeight: 'bold' },
});