import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator
} from 'react-native';
import MapView, { Marker, Circle, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import config from '../config';

const API_URL = config.API_URL;

const DEMO_HAZARDS = [
  { id: 1, type: 'pothole', lat: -20.1609, lng: 57.4992, severity: 'HIGH', area: 'Port Louis', reports: 12 },
  { id: 2, type: 'flood', lat: -20.2368, lng: 57.5165, severity: 'MEDIUM', area: 'Quatre Bornes', reports: 8 },
  { id: 3, type: 'accident', lat: -20.3484, lng: 57.5012, severity: 'HIGH', area: 'Rose Hill', reports: 5 },
  { id: 4, type: 'pothole', lat: -20.0474, lng: 57.5816, severity: 'LOW', area: 'Triolet', reports: 3 },
  { id: 5, type: 'roadblock', lat: -20.4637, lng: 57.4375, severity: 'MEDIUM', area: 'Mahebourg', reports: 6 },
  { id: 6, type: 'pothole', lat: -20.2540, lng: 57.4760, severity: 'HIGH', area: 'Vacoas', reports: 15 },
  { id: 7, type: 'flood', lat: -20.1020, lng: 57.5560, severity: 'HIGH', area: 'Flacq', reports: 10 },
  { id: 8, type: 'accident', lat: -20.1950, lng: 57.5830, severity: 'MEDIUM', area: 'Curepipe', reports: 7 },
  { id: 9, type: 'pothole', lat: -20.3900, lng: 57.6100, severity: 'LOW', area: 'Souillac', reports: 2 },
  { id: 10, type: 'signal', lat: -20.1650, lng: 57.4900, severity: 'MEDIUM', area: 'Port Louis North', reports: 4 },
];

const HAZARD_ICONS = {
  pothole: '🕳️', flood: '🌊', accident: '💥',
  roadblock: '🚧', signal: '🚦', debris: '⚠️', default: '📍',
};

const HAZARD_COLORS = {
  pothole: '#E74C3C', flood: '#3498DB', accident: '#FF6B35',
  roadblock: '#F39C12', signal: '#9B59B6', default: '#95A5A6',
};

const SEVERITY_COLORS = { HIGH: '#E74C3C', MEDIUM: '#F39C12', LOW: '#2ECC71' };

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [hazards, setHazards] = useState(DEMO_HAZARDS);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getLocation();
    fetchHazards();
  }, []);

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    }
  };

  const fetchHazards = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/hazards`);
      if (res.data && res.data.length > 0) setHazards(res.data);
    } catch (e) {
      console.log('Using demo hazards');
    }
    setLoading(false);
  };

  const filteredHazards = filter === 'all'
    ? hazards
    : hazards.filter(h => h.type === filter);

  const filterButtons = ['all', 'pothole', 'flood', 'accident', 'roadblock'];

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -20.2744,
          longitude: 57.5512,
          latitudeDelta: 0.8,
          longitudeDelta: 0.8,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Colored circles as heatmap substitute */}
        {filteredHazards.map((hazard) => (
          <Circle
            key={`circle-${hazard.id}`}
            center={{
              latitude: hazard.lat || hazard.latitude,
              longitude: hazard.lng || hazard.longitude,
            }}
            radius={hazard.severity === 'HIGH' ? 1500 : hazard.severity === 'MEDIUM' ? 1000 : 600}
            strokeColor={SEVERITY_COLORS[hazard.severity] + '80'}
            fillColor={SEVERITY_COLORS[hazard.severity] + '25'}
          />
        ))}

        {/* Hazard markers */}
        {filteredHazards.map((hazard) => (
          <Marker
            key={hazard.id}
            coordinate={{
              latitude: hazard.lat || hazard.latitude,
              longitude: hazard.lng || hazard.longitude,
            }}
          >
            <View style={[styles.markerPin, { backgroundColor: HAZARD_COLORS[hazard.type] || '#95A5A6' }]}>
              <Text style={styles.markerEmoji}>
                {HAZARD_ICONS[hazard.type] || HAZARD_ICONS.default}
              </Text>
            </View>
            <Callout style={styles.callout}>
              <Text style={styles.calloutTitle}>
                {HAZARD_ICONS[hazard.type]} {hazard.type?.toUpperCase()}
              </Text>
              <Text style={styles.calloutArea}>📍 {hazard.area}</Text>
              <Text style={[styles.calloutSeverity, { color: SEVERITY_COLORS[hazard.severity] }]}>
                ⚡ Severity: {hazard.severity}
              </Text>
              <Text style={styles.calloutReports}>👥 {hazard.reports} reports</Text>
            </Callout>
          </Marker>
        ))}

        {/* User location circle */}
        {location && (
          <Circle
            center={{ latitude: location.latitude, longitude: location.longitude }}
            radius={300}
            strokeColor="rgba(52,152,219,0.6)"
            fillColor="rgba(52,152,219,0.15)"
          />
        )}
      </MapView>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterButtons.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {HAZARD_ICONS[f] || '🗺️'} {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{filteredHazards.length}</Text>
          <Text style={styles.statLbl}>Hazards</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#E74C3C' }]}>
            {filteredHazards.filter(h => h.severity === 'HIGH').length}
          </Text>
          <Text style={styles.statLbl}>High Risk</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>
            {filteredHazards.reduce((s, h) => s + (h.reports || 0), 0)}
          </Text>
          <Text style={styles.statLbl}>Reports</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchHazards}>
          <Text style={styles.refreshText}>{loading ? '⏳' : '🔄'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  filterContainer: { position: 'absolute', top: 10, left: 0, right: 0 },
  filterScroll: { paddingHorizontal: 10, gap: 6 },
  filterBtn: {
    backgroundColor: 'rgba(26,26,46,0.92)',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#2d2d4e',
  },
  filterBtnActive: { backgroundColor: '#E74C3C', borderColor: '#E74C3C' },
  filterText: { color: '#bdc3c7', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  statsBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,13,26,0.95)',
    flexDirection: 'row', padding: 12, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#2d2d4e',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: 'bold', color: '#3498DB' },
  statLbl: { fontSize: 10, color: '#7f8c8d', marginTop: 2 },
  refreshBtn: { padding: 8 },
  refreshText: { fontSize: 20 },
  markerPin: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  markerEmoji: { fontSize: 18 },
  callout: { width: 180, padding: 8 },
  calloutTitle: { fontSize: 13, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  calloutArea: { fontSize: 12, color: '#555', marginBottom: 2 },
  calloutSeverity: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  calloutReports: { fontSize: 11, color: '#888' },
});