import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated
} from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import * as Location from 'expo-location';

const HARSH_BRAKE_THRESHOLD = 1.5;
const HARSH_ACCEL_THRESHOLD = 1.8;
const SWERVE_THRESHOLD = 1.6;
const SPEED_LIMIT = 60; // km/h default

export default function DriverScreen() {
  const [score, setScore] = useState(100);
  const [isTracking, setIsTracking] = useState(false);
  const [events, setEvents] = useState([]);
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [tripTime, setTripTime] = useState(0);
  const [stats, setStats] = useState({
    harshBrakes: 0, harshAccels: 0, swerves: 0, speedingEvents: 0
  });
  const [accelData, setAccelData] = useState({ x: 0, y: 0, z: 0 });
  const scoreAnim = useRef(new Animated.Value(100)).current;
  const accelSub = useRef(null);
  const gyroSub = useRef(null);
  const locationSub = useRef(null);
  const timerRef = useRef(null);
  const lastLocation = useRef(null);
  const lastBrakeTime = useRef(0);
  const lastSwerveTime = useRef(0);

  useEffect(() => {
    return () => stopTracking();
  }, []);

  const startTracking = async () => {
    setIsTracking(true);
    setScore(100);
    setEvents([]);
    setStats({ harshBrakes: 0, harshAccels: 0, swerves: 0, speedingEvents: 0 });
    setDistance(0);
    setTripTime(0);
    setMaxSpeed(0);

    // Timer
    timerRef.current = setInterval(() => setTripTime(t => t + 1), 1000);

    // Location
    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1000 },
      (loc) => {
        const spd = loc.coords.speed ? Math.max(0, loc.coords.speed * 3.6) : 0;
        setSpeed(Math.round(spd));
        setMaxSpeed(m => Math.max(m, Math.round(spd)));

        if (spd > SPEED_LIMIT) {
          setStats(s => ({ ...s, speedingEvents: s.speedingEvents + 1 }));
          deductScore(3, '🚨 Speeding detected');
        }

        if (lastLocation.current) {
          const d = getDistance(lastLocation.current, loc.coords);
          setDistance(prev => prev + d);
        }
        lastLocation.current = loc.coords;
      }
    );

    // Accelerometer
    Accelerometer.setUpdateInterval(100);
    accelSub.current = Accelerometer.addListener((data) => {
      setAccelData(data);
      const now = Date.now();

      // Harsh braking (sudden negative Y)
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

    // Gyroscope for swerves
    Gyroscope.setUpdateInterval(100);
    gyroSub.current = Gyroscope.addListener((data) => {
      const rotation = Math.abs(data.z);
      const now = Date.now();
      if (rotation > SWERVE_THRESHOLD && (now - lastSwerveTime.current) > 3000) {
        lastSwerveTime.current = now;
        setStats(s => ({ ...s, swerves: s.swerves + 1 }));
        deductScore(4, '⚠️ Sharp swerve/lane change');
      }
    });
  };

  const stopTracking = () => {
    setIsTracking(false);
    if (accelSub.current) accelSub.current.remove();
    if (gyroSub.current) gyroSub.current.remove();
    if (locationSub.current) locationSub.current.remove();
    if (timerRef.current) clearInterval(timerRef.current);
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
        <Text style={[styles.speedNum, { color: speed > SPEED_LIMIT ? '#E74C3C' : '#2ECC71' }]}>
          {speed}
        </Text>
        <Text style={styles.speedUnit}>km/h</Text>
        {speed > SPEED_LIMIT && (
          <Text style={styles.speedWarning}>⚠️ Over speed limit ({SPEED_LIMIT} km/h)</Text>
        )}
      </View>

      {/* Control Button */}
      <TouchableOpacity
        style={[styles.trackBtn, isTracking ? styles.trackBtnStop : styles.trackBtnStart]}
        onPress={isTracking ? stopTracking : startTracking}
      >
        <Text style={styles.trackBtnText}>
          {isTracking ? '⏹ END TRIP' : '▶ START TRIP TRACKING'}
        </Text>
      </TouchableOpacity>

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
        </View>
      </View>

      {/* Live Sensor Bar */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📡 Sensor Activity</Text>
        <SensorBar label="Longitudinal (braking/accel)" value={accelData.y} range={[-3, 3]} danger={HARSH_BRAKE_THRESHOLD} />
        <SensorBar label="Lateral (swerving)" value={accelData.x} range={[-3, 3]} danger={1.5} />
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
  trackBtn: {
    margin: 12, padding: 18, borderRadius: 14,
    alignItems: 'center',
  },
  trackBtnStart: { backgroundColor: '#27AE60' },
  trackBtnStop: { backgroundColor: '#E74C3C' },
  trackBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
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
});