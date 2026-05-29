import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, TextInput, Alert, Modal,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import config from '../config';
import { getSpeedLimitForLocation } from '../data/mauritiusData';
const API_URL = config.API_URL;

const HARSH_BRAKE_THRESHOLD = 1.5;
const HARSH_ACCEL_THRESHOLD = 1.8;
const SWERVE_THRESHOLD = 1.6;
const CRASH_THRESHOLD = 3.5;
const POTHOLE_THRESHOLD = 2.2; // vertical spike = pothole
// const SPEED_LIMIT = 60;
const SOS_COUNTDOWN_SECONDS = 10;
const SOS_COOLDOWN_MS = 30000; // 30s between SOS triggers

export default function DriverScreen() {
  const [score, setScore] = useState(100);
  const [isTracking, setIsTracking] = useState(false);
  const [events, setEvents] = useState([]);
  const [speed, setSpeed] = useState(0);
  const [currentZone, setCurrentZone] = useState({ limit: 60, name: 'General road', type: 'general' });
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [tripTime, setTripTime] = useState(0);
  const [stats, setStats] = useState({
    harshBrakes: 0, harshAccels: 0, swerves: 0, speedingEvents: 0, potholes: 0
  });
  const [accelData, setAccelData] = useState({ x: 0, y: 0, z: 0 });

  // Emergency contact
  const [emergencyContact, setEmergencyContact] = useState('');
  const [showContactSetup, setShowContactSetup] = useState(false);
  const [contactInput, setContactInput] = useState('');

  // SOS
  const [sosActive, setSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(SOS_COUNTDOWN_SECONDS);

  const scoreAnim = useRef(new Animated.Value(100)).current;
  const accelSub = useRef(null);
  const gyroSub = useRef(null);
  const locationSub = useRef(null);
  const timerRef = useRef(null);
  const sosTimerRef = useRef(null);
  const lastLocation = useRef(null);
  const lastBrakeTime = useRef(0);
  const lastSwerveTime = useRef(0);
  const lastCrashTime = useRef(0);
  const lastPotholeTime = useRef(0);
  const lastSosTriggerTime = useRef(0);
  const locationRef = useRef(null);
  const sosActiveRef = useRef(false);

  useEffect(() => {
    loadEmergencyContact();
    return () => stopTracking();
  }, []);

  const loadEmergencyContact = async () => {
    try {
      const saved = await AsyncStorage.getItem('emergencyContact');
      if (saved) {
        setEmergencyContact(saved);
      } else {
        setShowContactSetup(true);
      }
    } catch (e) {}
  };

  const saveEmergencyContact = async () => {
    Keyboard.dismiss();
    const num = contactInput.replace(/\s/g, '');
    if (!num || num.length < 7) {
      Alert.alert('Invalid number', 'Please enter a valid phone number with country code.');
      return;
    }
    try {
      await AsyncStorage.setItem('emergencyContact', num);
      setEmergencyContact(num);
      setShowContactSetup(false);
      Alert.alert('✅ Contact Saved', `Emergency SOS will be sent to ${num}`);
    } catch (e) {}
  };

  const startTracking = async () => {
    if (!emergencyContact) {
      setShowContactSetup(true);
      return;
    }
    setIsTracking(true);
    setScore(100);
    setEvents([]);
    setStats({ harshBrakes: 0, harshAccels: 0, swerves: 0, speedingEvents: 0, potholes: 0 });
    setDistance(0);
    setTripTime(0);
    setMaxSpeed(0);

    timerRef.current = setInterval(() => setTripTime(t => t + 1), 1000);

    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000 },
      (loc) => {
        const spd = loc.coords.speed ? Math.max(0, loc.coords.speed * 3.6) : 0;
        setSpeed(Math.round(spd));
        setMaxSpeed(m => Math.max(m, Math.round(spd)));
        // locationRef.current = loc.coords;
        // Get real Mauritius speed limit for current location
        const zone = getSpeedLimitForLocation(loc.coords.latitude, loc.coords.longitude);
        setCurrentZone(zone);

        if (spd > zone.limit) {
          setStats(s => ({ ...s, speedingEvents: s.speedingEvents + 1 }));
          deductScore(3, `🚨 Speeding in ${zone.name} (limit: ${zone.limit} km/h)`);
        }

        if (lastLocation.current) {
          const d = getDistance(lastLocation.current, loc.coords);
          setDistance(prev => prev + d);
        }
        lastLocation.current = loc.coords;
      }
    );

    Accelerometer.setUpdateInterval(100);
    accelSub.current = Accelerometer.addListener((data) => {
      setAccelData(data);
      const now = Date.now();
      const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

      // Crash detection (high overall G)
      if (magnitude > CRASH_THRESHOLD && (now - lastCrashTime.current) > SOS_COOLDOWN_MS) {
        lastCrashTime.current = now;
        triggerCrashSOS();
        return;
      }

      // Pothole detection: sharp vertical (Z-axis) spike while moving
      const verticalSpike = Math.abs(data.z - 1); // ~1g is resting gravity
      if (verticalSpike > POTHOLE_THRESHOLD && (now - lastPotholeTime.current) > 3000) {
        lastPotholeTime.current = now;
        setStats(s => ({ ...s, potholes: s.potholes + 1 }));
        deductScore(2, '🕳️ Pothole detected');
        autoReportPothole();
      }

      // Harsh braking
      if (data.y < -HARSH_BRAKE_THRESHOLD && (now - lastBrakeTime.current) > 3000) {
        lastBrakeTime.current = now;
        setStats(s => ({ ...s, harshBrakes: s.harshBrakes + 1 }));
        deductScore(5, '🛑 Harsh braking');
      }

      // Harsh acceleration
      if (data.y > HARSH_ACCEL_THRESHOLD) {
        setStats(s => ({ ...s, harshAccels: s.harshAccels + 1 }));
        deductScore(3, '⚡ Harsh acceleration');
      }
    });

    Gyroscope.setUpdateInterval(100);
    gyroSub.current = Gyroscope.addListener((data) => {
      const rotation = Math.abs(data.z);
      const now = Date.now();
      if (rotation > SWERVE_THRESHOLD && (now - lastSwerveTime.current) > 3000) {
        lastSwerveTime.current = now;
        setStats(s => ({ ...s, swerves: s.swerves + 1 }));
        deductScore(4, '⚠️ Sharp swerve');
      }
    });
  };

  const autoReportPothole = async () => {
    const loc = locationRef.current;
    if (!loc) return;
    try {
      await axios.post(`${API_URL}/api/reports`, {
        type: 'pothole',
        severity: 'MEDIUM',
        description: 'Auto-detected by sensor during trip monitoring',
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: new Date().toISOString(),
        anonymous: true,
        autoDetected: true,
      });
      console.log('[AUTO-REPORT] Pothole reported at', loc.latitude, loc.longitude);
    } catch (e) {
      console.log('[AUTO-REPORT] Failed, saved offline');
    }
  };

  const stopTracking = () => {
    setIsTracking(false);
    if (accelSub.current) accelSub.current.remove();
    if (gyroSub.current) gyroSub.current.remove();
    if (locationSub.current) locationSub.current.remove();
    if (timerRef.current) clearInterval(timerRef.current);
    cancelSOS();
  };

  const triggerCrashSOS = () => {
    const now = Date.now();
    // Cooldown: don't re-trigger if SOS already active or within cooldown
    if (sosActiveRef.current || (now - lastSosTriggerTime.current) < SOS_COOLDOWN_MS) return;

    lastSosTriggerTime.current = now;
    sosActiveRef.current = true;
    setSosActive(true);
    setSosCountdown(SOS_COUNTDOWN_SECONDS);

    let count = SOS_COUNTDOWN_SECONDS;
    sosTimerRef.current = setInterval(() => {
      count -= 1;
      setSosCountdown(count);
      if (count <= 0) {
        clearInterval(sosTimerRef.current);
        sosActiveRef.current = false;
        sendSOSWhatsApp();
        setSosActive(false);
      }
    }, 1000);
  };

  const cancelSOS = () => {
    sosActiveRef.current = false;
    setSosActive(false);
    setSosCountdown(SOS_COUNTDOWN_SECONDS);
    if (sosTimerRef.current) clearInterval(sosTimerRef.current);
  };

  const sendSOSWhatsApp = () => {
    const loc = locationRef.current;
    const mapsLink = loc
      ? `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`
      : 'Location unavailable';

    const message = encodeURIComponent(
      `🆘 EMERGENCY ALERT from RoadSafe!\n\nA crash has been detected. I may need help.\n\n📍 My location:\n${mapsLink}\n\nPlease call me or send help immediately.`
    );

    const phone = emergencyContact.replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${message}`;

    Linking.openURL(url).catch(() => {
      Linking.openURL(`sms:${emergencyContact}?body=${message}`);
    });
  };

  const manualSOS = () => {
    if (!emergencyContact) {
      setShowContactSetup(true);
      return;
    }
    Alert.alert(
      '🆘 Send SOS?',
      `This will send an emergency WhatsApp message to ${emergencyContact} with your current location.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send SOS Now', style: 'destructive', onPress: sendSOSWhatsApp },
      ]
    );
  };

  const deductScore = (points, reason) => {
    setScore(s => {
      const newScore = Math.max(0, s - points);
      Animated.timing(scoreAnim, { toValue: newScore, duration: 500, useNativeDriver: false }).start();
      return newScore;
    });
    addEvent(reason, points);
  };

  const addEvent = (reason, deduction) => {
    setEvents(prev => [
      { reason, deduction, time: new Date().toLocaleTimeString(), id: Date.now() },
      ...prev
    ].slice(0, 15));
  };

  const getScoreGrade = (s) => {
    if (s >= 90) return { grade: 'A+', label: 'Excellent Driver', color: '#2ECC71' };
    if (s >= 80) return { grade: 'A', label: 'Good Driver', color: '#27AE60' };
    if (s >= 70) return { grade: 'B', label: 'Average Driver', color: '#F39C12' };
    if (s >= 60) return { grade: 'C', label: 'Needs Improvement', color: '#E67E22' };
    return { grade: 'D', label: 'Dangerous Driver', color: '#E74C3C' };
  };

  const getDistance = (c1, c2) => {
    const R = 6371e3;
    const p1 = c1.latitude * Math.PI / 180;
    const p2 = c2.latitude * Math.PI / 180;
    const dp = (c2.latitude - c1.latitude) * Math.PI / 180;
    const dl = (c2.longitude - c1.longitude) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) / 1000;
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const gradeInfo = getScoreGrade(score);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Emergency Contact Bar */}
        <TouchableOpacity style={styles.contactBar} onPress={() => {
          setContactInput(emergencyContact);
          setShowContactSetup(true);
        }}>
          <Text style={styles.contactBarText}>
            {emergencyContact
              ? `🆘 SOS Contact: ${emergencyContact}`
              : '⚠️ Tap to set emergency SOS contact'}
          </Text>
          <Text style={styles.contactBarEdit}>Edit</Text>
        </TouchableOpacity>

        {/* Score Circle */}
        <View style={styles.scoreSection}>
          <View style={[styles.scoreCircle, { borderColor: gradeInfo.color }]}>
            <Text style={[styles.scoreNumber, { color: gradeInfo.color }]}>{score}</Text>
            <Text style={[styles.scoreGrade, { color: gradeInfo.color }]}>{gradeInfo.grade}</Text>
          </View>
          <Text style={[styles.scoreLabel, { color: gradeInfo.color }]}>{gradeInfo.label}</Text>
          <Text style={styles.scoreSubtitle}>Driver Safety Score</Text>
        </View>

        {/* Live Speed */}
        <View style={styles.speedCard}>
          <Text style={[styles.speedNum, { color: speed > currentZone.limit ? '#E74C3C' : '#2ECC71' }]}>
            {speed}
          </Text>
          <Text style={styles.speedUnit}>km/h</Text>
          <View style={styles.limitRow}>
            <Text style={styles.limitLabel}>Speed limit:</Text>
            <Text style={[styles.limitValue, { color: speed > currentZone.limit ? '#E74C3C' : '#bdc3c7' }]}>
              {currentZone.limit} km/h
            </Text>
          </View>
          <Text style={styles.zoneName}>{currentZone.name}</Text>
          {speed > currentZone.limit && (
            <Text style={styles.speedWarning}>
              🚨 OVER LIMIT by {Math.round(speed - currentZone.limit)} km/h!
            </Text>
          )}
        </View>

        {/* Control Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.trackBtn, isTracking ? styles.trackBtnStop : styles.trackBtnStart]}
            onPress={isTracking ? stopTracking : startTracking}
          >
            <Text style={styles.trackBtnText}>
              {isTracking ? '⏹ END TRIP' : '▶ START TRIP'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sosBtn} onPress={manualSOS}>
            <Text style={styles.sosBtnText}>🆘 SOS</Text>
          </TouchableOpacity>
        </View>

        {/* Trip Stats */}
        <View style={styles.tripStatsGrid}>
          <View style={styles.tripStatCard}>
            <Text style={styles.tripStatNum}>{distance.toFixed(1)}</Text>
            <Text style={styles.tripStatLabel}>km driven</Text>
          </View>
          <View style={styles.tripStatCard}>
            <Text style={styles.tripStatNum}>{formatTime(tripTime)}</Text>
            <Text style={styles.tripStatLabel}>trip time</Text>
          </View>
          <View style={styles.tripStatCard}>
            <Text style={styles.tripStatNum}>{maxSpeed}</Text>
            <Text style={styles.tripStatLabel}>max km/h</Text>
          </View>
        </View>

        {/* Behavior Stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎯 Driving Behavior</Text>
          <View style={styles.behaviorGrid}>
            <BehaviorItem icon="🛑" label="Harsh Brakes" count={stats.harshBrakes} deduction={5} />
            <BehaviorItem icon="⚡" label="Harsh Accel" count={stats.harshAccels} deduction={3} />
            <BehaviorItem icon="↔️" label="Sharp Swerves" count={stats.swerves} deduction={4} />
            <BehaviorItem icon="🚨" label="Speeding" count={stats.speedingEvents} deduction={3} />
            <BehaviorItem icon="🕳️" label="Potholes Hit" count={stats.potholes} deduction={2} />
          </View>
        </View>

        {/* Sensor Bar */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📡 Sensor Activity</Text>
          <SensorBar label="Longitudinal (braking/accel)" value={accelData.y} range={[-3, 3]} danger={HARSH_BRAKE_THRESHOLD} />
          <SensorBar label="Lateral (swerving)" value={accelData.x} range={[-3, 3]} danger={1.5} />
          <SensorBar label="Vertical (potholes)" value={accelData.z} range={[-2, 4]} danger={POTHOLE_THRESHOLD + 1} />
        </View>

        {/* Event Log */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Trip Events</Text>
          {events.length === 0 ? (
            <Text style={styles.emptyText}>No events recorded yet — drive smoothly!</Text>
          ) : (
            events.map(e => (
              <View key={e.id} style={styles.eventItem}>
                <Text style={styles.eventReason}>{e.reason}</Text>
                <View style={styles.eventRight}>
                  <Text style={styles.eventDeduction}>-{e.deduction} pts</Text>
                  <Text style={styles.eventTime}>{e.time}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Tips */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💡 Safety Tips for Mauritius Roads</Text>
          {[
            '🛣️ Watch for potholes on B roads, especially after rain',
            '🌧️ Reduce speed on wet roads — Mauritius roads can get slippery',
            '🚌 Be cautious near bus stops — sudden stops are common',
            '🌀 During cyclone warnings, avoid road travel entirely',
            '🔦 Many rural roads lack street lighting at night',
          ].map((tip, i) => (
            <Text key={i} style={styles.tipText}>{tip}</Text>
          ))}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* SOS Countdown Overlay — shown once, has cooldown */}
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

      {/* Emergency Contact Setup Modal */}
      <Modal visible={showContactSetup} transparent animationType="slide" onRequestClose={() => {
        if (emergencyContact) setShowContactSetup(false);
      }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKAV}
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>🆘 Emergency SOS Contact</Text>
                <Text style={styles.modalSubtitle}>
                  If a crash is detected, RoadSafe will automatically send a WhatsApp SOS message
                  with your GPS location after a {SOS_COUNTDOWN_SECONDS}-second countdown.
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={contactInput}
                  onChangeText={setContactInput}
                  placeholder="+230 5XXX XXXX"
                  placeholderTextColor="#7f8c8d"
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={saveEmergencyContact}
                />
                <Text style={styles.modalHint}>
                  💡 Include country code — e.g. +23057123456 for Mauritius
                </Text>
                <TouchableOpacity style={styles.modalGoBtn} onPress={saveEmergencyContact}>
                  <Text style={styles.modalGoBtnText}>💾 Save Contact</Text>
                </TouchableOpacity>
                {emergencyContact ? (
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => {
                    Keyboard.dismiss();
                    setShowContactSetup(false);
                  }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function BehaviorItem({ icon, label, count, deduction }) {
  return (
    <View style={styles.behaviorItem}>
      <Text style={styles.behaviorIcon}>{icon}</Text>
      <Text style={styles.behaviorCount}>{count}</Text>
      <Text style={styles.behaviorLabel}>{label}</Text>
      <Text style={styles.behaviorDeduction}>-{deduction}pts each</Text>
    </View>
  );
}

function SensorBar({ label, value, range, danger }) {
  const pct = ((value - range[0]) / (range[1] - range[0])) * 100;
  const clamped = Math.min(100, Math.max(0, pct));
  const isActive = Math.abs(value) > danger;
  return (
    <View style={styles.sensorBarWrapper}>
      <View style={styles.sensorBarHeader}>
        <Text style={styles.sensorBarLabel}>{label}</Text>
        <Text style={[styles.sensorBarValue, isActive && { color: '#E74C3C' }]}>
          {value.toFixed(2)}
        </Text>
      </View>
      <View style={styles.sensorBarBg}>
        <View style={[styles.sensorBarFill, { width: `${clamped}%`, backgroundColor: isActive ? '#E74C3C' : '#3498DB' }]} />
        <View style={styles.sensorBarCenter} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },

  contactBar: {
    backgroundColor: '#1a1a2e', padding: 12,
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#2d2d4e',
  },
  contactBarText: { flex: 1, color: '#ecf0f1', fontSize: 13 },
  contactBarEdit: { color: '#3498DB', fontSize: 13, fontWeight: '600' },

  scoreSection: { alignItems: 'center', padding: 24 },
  scoreCircle: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 4, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  scoreNumber: { fontSize: 44, fontWeight: 'bold' },
  scoreGrade: { fontSize: 22, fontWeight: 'bold' },
  scoreLabel: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  scoreSubtitle: { color: '#7f8c8d', fontSize: 13, marginTop: 4 },

  speedCard: {
    backgroundColor: '#1a1a2e', marginHorizontal: 12, borderRadius: 14,
    padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2d2d4e',
    marginBottom: 8,
  },
  speedNum: { fontSize: 56, fontWeight: 'bold', lineHeight: 64 },
  speedUnit: { color: '#7f8c8d', fontSize: 16 },
  speedWarning: { color: '#E74C3C', fontSize: 14, fontWeight: '600', marginTop: 6 },

  buttonRow: { flexDirection: 'row', marginHorizontal: 12, gap: 8, marginBottom: 8 },
  trackBtn: { flex: 1, padding: 18, borderRadius: 14, alignItems: 'center' },
  trackBtnStart: { backgroundColor: '#27AE60' },
  trackBtnStop: { backgroundColor: '#E74C3C' },
  trackBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sosBtn: {
    backgroundColor: '#C0392B', paddingHorizontal: 20, paddingVertical: 18,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#E74C3C',
  },
  sosBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  tripStatsGrid: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  tripStatCard: {
    flex: 1, backgroundColor: '#1a1a2e', borderRadius: 12,
    padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2d2d4e',
  },
  tripStatNum: { fontSize: 22, fontWeight: 'bold', color: '#3498DB' },
  tripStatLabel: { fontSize: 11, color: '#7f8c8d', marginTop: 4 },

  card: {
    backgroundColor: '#1a1a2e', margin: 12, marginTop: 0,
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2d2d4e',
    marginBottom: 8,
  },
  cardTitle: { color: '#ecf0f1', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  behaviorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  behaviorItem: {
    flex: 1, minWidth: '45%', backgroundColor: '#0d0d1a',
    borderRadius: 10, padding: 12, alignItems: 'center',
  },
  behaviorIcon: { fontSize: 24, marginBottom: 4 },
  behaviorCount: { fontSize: 26, fontWeight: 'bold', color: '#E74C3C' },
  behaviorLabel: { fontSize: 11, color: '#bdc3c7', textAlign: 'center' },
  behaviorDeduction: { fontSize: 10, color: '#7f8c8d', marginTop: 2 },

  eventItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2d2d4e',
  },
  eventReason: { color: '#ecf0f1', fontSize: 13, flex: 1 },
  eventRight: { alignItems: 'flex-end', marginLeft: 8 },
  eventDeduction: { color: '#E74C3C', fontSize: 12, fontWeight: '700' },
  eventTime: { color: '#7f8c8d', fontSize: 10 },
  emptyText: { color: '#7f8c8d', textAlign: 'center', padding: 12 },
  tipText: { color: '#bdc3c7', fontSize: 13, marginBottom: 8, lineHeight: 20 },

  sensorBarWrapper: { marginBottom: 12 },
  sensorBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sensorBarLabel: { color: '#bdc3c7', fontSize: 12 },
  sensorBarValue: { color: '#3498DB', fontSize: 12, fontWeight: '700' },
  sensorBarBg: { height: 8, backgroundColor: '#0d0d1a', borderRadius: 4, overflow: 'hidden', position: 'relative' },
  sensorBarFill: { height: '100%', borderRadius: 4, position: 'absolute', left: 0 },
  sensorBarCenter: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: '#2d2d4e' },

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

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalKAV: { justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: '#E74C3C',
  },
  modalTitle: { color: '#ecf0f1', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  modalSubtitle: { color: '#7f8c8d', fontSize: 13, marginBottom: 16, lineHeight: 20 },
  modalInput: {
    backgroundColor: '#0d0d1a', color: '#ecf0f1',
    borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#2d2d4e',
    fontSize: 15, marginBottom: 8,
  },
  modalHint: { color: '#3498DB', fontSize: 12, marginBottom: 16 },
  modalGoBtn: {
    backgroundColor: '#E74C3C', borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 10,
  },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  limitLabel: { color: '#7f8c8d', fontSize: 13 },
  limitValue: { fontSize: 14, fontWeight: '700' },
  zoneName: { color: '#7f8c8d', fontSize: 11, marginTop: 2 },
  modalGoBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  modalCancelBtn: { padding: 12, alignItems: 'center' },
  modalCancelText: { color: '#7f8c8d', fontSize: 14 },
});