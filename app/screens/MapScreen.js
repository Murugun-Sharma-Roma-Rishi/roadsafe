import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput, Modal,
  Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import MapView, { Marker, Circle, Polyline, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import axios from 'axios';
import config from '../config';

const API_URL = config.API_URL;

const DEMO_HAZARDS = [
  { id: 'demo-1', type: 'pothole', latitude: -20.1609, longitude: 57.4992, severity: 'HIGH', area: 'Port Louis', reports: 12 },
  { id: 'demo-2', type: 'flood', latitude: -20.2368, longitude: 57.5165, severity: 'MEDIUM', area: 'Quatre Bornes', reports: 8 },
  { id: 'demo-3', type: 'accident', latitude: -20.3484, longitude: 57.5012, severity: 'HIGH', area: 'Rose Hill', reports: 5 },
  { id: 'demo-4', type: 'pothole', latitude: -20.0474, longitude: 57.5816, severity: 'LOW', area: 'Triolet', reports: 3 },
  { id: 'demo-5', type: 'roadblock', latitude: -20.4637, longitude: 57.4375, severity: 'MEDIUM', area: 'Mahebourg', reports: 6 },
  { id: 'demo-6', type: 'pothole', latitude: -20.2540, longitude: 57.4760, severity: 'HIGH', area: 'Vacoas', reports: 15 },
  { id: 'demo-7', type: 'flood', latitude: -20.1020, longitude: 57.5560, severity: 'HIGH', area: 'Flacq', reports: 10 },
  { id: 'demo-8', type: 'accident', latitude: -20.1950, longitude: 57.5830, severity: 'MEDIUM', area: 'Curepipe', reports: 7 },
  { id: 'demo-9', type: 'pothole', latitude: -20.3900, longitude: 57.6100, severity: 'LOW', area: 'Souillac', reports: 2 },
  { id: 'demo-10', type: 'signal', latitude: -20.1650, longitude: 57.4900, severity: 'MEDIUM', area: 'Port Louis North', reports: 4 },
];

const HAZARD_ICONS = {
  pothole: '🕳️', flood: '🌊', accident: '💥',
  roadblock: '🚧', signal: '🚦', debris: '⚠️', default: '📍',
};

const HAZARD_COLORS = {
  pothole: '#E74C3C', flood: '#3498DB', accident: '#FF6B35',
  roadblock: '#F39C12', signal: '#9B59B6', debris: '#95A5A6', default: '#95A5A6',
};

const SEVERITY_COLORS = { HIGH: '#E74C3C', MEDIUM: '#F39C12', LOW: '#2ECC71' };

function getHazardRadius(type, severity) {
  if (type === 'pothole') return 0;
  if (type === 'accident') return severity === 'HIGH' ? 200 : 100;
  if (type === 'flood') return severity === 'HIGH' ? 800 : 400;
  return severity === 'HIGH' ? 500 : severity === 'MEDIUM' ? 300 : 150;
}

function isHazardOnRoute(hazard, origin, dest, bufferDeg = 0.03) {
  if (!origin || !dest) return false;
  const minLat = Math.min(origin.latitude, dest.latitude) - bufferDeg;
  const maxLat = Math.max(origin.latitude, dest.latitude) + bufferDeg;
  const minLng = Math.min(origin.longitude, dest.longitude) - bufferDeg;
  const maxLng = Math.max(origin.longitude, dest.longitude) + bufferDeg;
  const lat = hazard.latitude ?? hazard.lat;
  const lng = hazard.longitude ?? hazard.lng;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

// Fetch actual route polyline from OSRM (free, no API key)
async function fetchRoute(origin, dest) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes[0]) {
      const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }));
      return coords;
    }
  } catch (e) {
    console.log('Route fetch failed, using straight line');
  }
  return null;
}

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [hazards, setHazards] = useState(DEMO_HAZARDS);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const [tripMode, setTripMode] = useState(false);
  const [destInput, setDestInput] = useState('');
  const [destCoords, setDestCoords] = useState(null);
  const [tripHazards, setTripHazards] = useState([]);
  const [routeCoords, setRouteCoords] = useState(null);
  const [showTripModal, setShowTripModal] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const mapRef = useRef(null);

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
      const [hazardsRes, reportsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/hazards`),
        axios.get(`${API_URL}/api/reports`),
      ]);

      const hazardData = hazardsRes.status === 'fulfilled' && hazardsRes.value.data?.length > 0
        ? hazardsRes.value.data.map(h => ({ ...h, id: `hazard-${h.id}` })) : [];

      const reportData = reportsRes.status === 'fulfilled' && reportsRes.value.data?.length > 0
        ? reportsRes.value.data
            .filter(r => r.latitude && r.longitude)
            .map(r => ({ ...r, id: `report-${r.id}`, _isReport: true }))
        : [];

      const merged = [...DEMO_HAZARDS, ...hazardData, ...reportData];

      // Deduplicate by id
      const seen = new Set();
      const deduped = merged.filter(h => {
        if (seen.has(h.id)) return false;
        seen.add(h.id);
        return true;
      });

      setHazards(deduped);
    } catch (e) {
      console.log('Using demo hazards');
    }
    setLoading(false);
  };

  const geocodeDestination = async () => {
    if (!destInput.trim()) return;
    Keyboard.dismiss();
    setRouteLoading(true);
    try {
      const results = await Location.geocodeAsync(destInput + ', Mauritius');
      if (results.length > 0) {
        const dest = { latitude: results[0].latitude, longitude: results[0].longitude };
        setDestCoords(dest);

        // Fetch real road route
        const route = location ? await fetchRoute(location, dest) : null;
        setRouteCoords(route);

        // Filter hazards near route
        const onRoute = hazards.filter(h => isHazardOnRoute(h, location, dest));
        setTripHazards(onRoute);
        setTripMode(true);
        setShowTripModal(false);

        if (mapRef.current && location) {
          const points = route ? route : [
            { latitude: location.latitude, longitude: location.longitude },
            dest,
          ];
          mapRef.current.fitToCoordinates(points, {
            edgePadding: { top: 80, right: 40, bottom: 120, left: 40 },
            animated: true,
          });
        }
      } else {
        Alert.alert('Location not found', 'Try a more specific address in Mauritius.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not find that location.');
    }
    setRouteLoading(false);
  };

  const cancelTrip = () => {
    setTripMode(false);
    setDestCoords(null);
    setDestInput('');
    setTripHazards([]);
    setRouteCoords(null);
  };

  const activeHazards = tripMode
    ? tripHazards
    : (filter === 'all' ? hazards : hazards.filter(h => h.type === filter));

  const filterButtons = ['all', 'pothole', 'flood', 'accident', 'roadblock'];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
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
        {/* Hazard circles — non-pothole types only */}
        {activeHazards.map((hazard) => {
          const lat = hazard.latitude ?? hazard.lat;
          const lng = hazard.longitude ?? hazard.lng;
          const radius = getHazardRadius(hazard.type, hazard.severity);
          if (!radius || !lat || !lng) return null;
          return (
            <Circle
              key={`circle-${hazard.id}`}
              center={{ latitude: lat, longitude: lng }}
              radius={radius}
              strokeColor={SEVERITY_COLORS[hazard.severity] + '80'}
              fillColor={SEVERITY_COLORS[hazard.severity] + '25'}
            />
          );
        })}

        {/* Hazard markers */}
        {activeHazards.map((hazard) => {
          const lat = hazard.latitude ?? hazard.lat;
          const lng = hazard.longitude ?? hazard.lng;
          if (!lat || !lng) return null;
          return (
            <Marker
              key={`marker-${hazard.id}`}
              coordinate={{ latitude: lat, longitude: lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[
                styles.markerPin,
                { backgroundColor: HAZARD_COLORS[hazard.type] || '#95A5A6' },
                hazard._isReport && styles.reportMarkerBorder,
              ]}>
                <Text style={styles.markerEmoji}>
                  {HAZARD_ICONS[hazard.type] || HAZARD_ICONS.default}
                </Text>
                {hazard._isReport && (
                  <View style={styles.reportBadge}>
                    <Text style={styles.reportBadgeText}>!</Text>
                  </View>
                )}
              </View>
              <Callout style={styles.callout}>
                <Text style={styles.calloutTitle}>
                  {HAZARD_ICONS[hazard.type]} {hazard.type?.toUpperCase()}
                  {hazard._isReport ? ' (Reported)' : ''}
                </Text>
                {hazard.area ? <Text style={styles.calloutArea}>📍 {hazard.area}</Text> : null}
                <Text style={[styles.calloutSeverity, { color: SEVERITY_COLORS[hazard.severity] }]}>
                  ⚡ {hazard.severity}
                </Text>
                {hazard.description ? (
                  <Text style={styles.calloutDesc}>{hazard.description}</Text>
                ) : null}
                <Text style={styles.calloutReports}>👥 {hazard.reports || 1} report(s)</Text>
                <Text style={styles.calloutCoords}>
                  {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                </Text>
              </Callout>
            </Marker>
          );
        })}

        {/* Destination marker */}
        {tripMode && destCoords && (
          <Marker coordinate={destCoords} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.destMarker}>
              <Text style={styles.destMarkerText}>🏁</Text>
            </View>
          </Marker>
        )}

        {/* Real road route OR fallback dashed line */}
        {tripMode && destCoords && location && (
          <Polyline
            coordinates={routeCoords || [
              { latitude: location.latitude, longitude: location.longitude },
              destCoords,
            ]}
            strokeColor="#3498DB"
            strokeWidth={4}
            lineDashPattern={routeCoords ? undefined : [8, 4]}
          />
        )}
      </MapView>

      {/* Top bar */}
      {!tripMode ? (
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
      ) : (
        <View style={styles.tripBanner}>
          <Text style={styles.tripBannerText} numberOfLines={1}>
            🗺️ <Text style={{ color: '#2ECC71' }}>{destInput}</Text>
            {'  '}⚠️ {tripHazards.length} hazard(s)
          </Text>
          <TouchableOpacity style={styles.cancelTripBtn} onPress={cancelTrip}>
            <Text style={styles.cancelTripText}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{activeHazards.length}</Text>
          <Text style={styles.statLbl}>{tripMode ? 'On Route' : 'Hazards'}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#E74C3C' }]}>
            {activeHazards.filter(h => h.severity === 'HIGH').length}
          </Text>
          <Text style={styles.statLbl}>High Risk</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>
            {activeHazards.reduce((s, h) => s + (h.reports || 1), 0)}
          </Text>
          <Text style={styles.statLbl}>Reports</Text>
        </View>
        <TouchableOpacity
          style={styles.tripBtn}
          onPress={() => { if (tripMode) { cancelTrip(); } else { setShowTripModal(true); } }}
        >
          <Text style={styles.tripBtnText}>{tripMode ? '🗺️ Clear' : '🗺️ Trip'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchHazards}>
          <Text style={styles.refreshText}>{loading ? '⏳' : '🔄'}</Text>
        </TouchableOpacity>
      </View>

      {/* Trip Planner Modal */}
      <Modal visible={showTripModal} transparent animationType="slide" onRequestClose={() => setShowTripModal(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKAV}
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>🗺️ Plan Your Trip</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your destination to see hazards on your route
                </Text>
                <TextInput
                  style={styles.modalInput}
                  value={destInput}
                  onChangeText={setDestInput}
                  placeholder="e.g. Grand Baie, Curepipe, Port Louis..."
                  placeholderTextColor="#7f8c8d"
                  returnKeyType="search"
                  onSubmitEditing={geocodeDestination}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[styles.modalGoBtn, routeLoading && { opacity: 0.6 }]}
                  onPress={geocodeDestination}
                  disabled={routeLoading}
                >
                  {routeLoading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.modalGoBtnText}>🔍 Show Route Hazards</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { Keyboard.dismiss(); setShowTripModal(false); }}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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

  tripBanner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,13,26,0.96)',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#3498DB',
  },
  tripBannerText: { flex: 1, color: '#ecf0f1', fontSize: 13 },
  cancelTripBtn: {
    backgroundColor: '#E74C3C', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  cancelTripText: { color: '#fff', fontWeight: '700', fontSize: 13 },

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
  tripBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#3498DB', marginRight: 4,
  },
  tripBtnText: { color: '#3498DB', fontSize: 12, fontWeight: '700' },

  markerPin: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  reportMarkerBorder: { borderColor: '#FFD700', borderWidth: 3 },
  reportBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#FFD700', borderRadius: 8,
    width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  reportBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#000' },
  markerEmoji: { fontSize: 18 },

  destMarker: {
    backgroundColor: '#1a1a2e', borderRadius: 20,
    padding: 6, borderWidth: 2, borderColor: '#2ECC71',
  },
  destMarkerText: { fontSize: 20 },

  callout: { width: 180, padding: 8 },
  calloutTitle: { fontSize: 13, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  calloutArea: { fontSize: 12, color: '#555', marginBottom: 2 },
  calloutSeverity: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  calloutDesc: { fontSize: 11, color: '#444', marginBottom: 2, fontStyle: 'italic' },
  calloutReports: { fontSize: 11, color: '#888' },
  calloutCoords: { fontSize: 10, color: '#aaa', marginTop: 2, fontFamily: 'monospace' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalKAV: { justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: '#3498DB',
  },
  modalTitle: { color: '#ecf0f1', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  modalSubtitle: { color: '#7f8c8d', fontSize: 13, marginBottom: 16 },
  modalInput: {
    backgroundColor: '#0d0d1a', color: '#ecf0f1',
    borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#2d2d4e',
    fontSize: 15, marginBottom: 12,
  },
  modalGoBtn: {
    backgroundColor: '#3498DB', borderRadius: 12,
    padding: 16, alignItems: 'center', marginBottom: 10,
  },
  modalGoBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  modalCancelBtn: { padding: 12, alignItems: 'center' },
  modalCancelText: { color: '#7f8c8d', fontSize: 14 },
});