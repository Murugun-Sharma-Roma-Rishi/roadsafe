import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, Alert, Modal, FlatList
} from 'react-native';
import MapView, { Marker, Circle, Callout, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import config from '../config';
import {
  ACCIDENT_BLACK_SPOTS,
  TRAFFIC_SEGMENTS,
  SPEED_ZONES,
  getSpeedLimitForLocation,
  getTrafficColor,
} from '../data/mauritiusData';

const API_URL = config.API_URL;

const DEMO_HAZARDS = [
  { id: 1, type: 'pothole', lat: -20.1609, lng: 57.4992, severity: 'HIGH', area: 'Port Louis', reports: 12 },
  { id: 2, type: 'flood', lat: -20.2368, lng: 57.5165, severity: 'MEDIUM', area: 'Quatre Bornes', reports: 8 },
  { id: 3, type: 'accident', lat: -20.3484, lng: 57.5012, severity: 'HIGH', area: 'Rose Hill', reports: 5 },
  { id: 4, type: 'pothole', lat: -20.0474, lng: 57.5816, severity: 'LOW', area: 'Triolet', reports: 3 },
  { id: 5, type: 'roadblock', lat: -20.4637, lng: 57.4375, severity: 'MEDIUM', area: 'Mahebourg', reports: 6 },
  { id: 6, type: 'pothole', lat: -20.2540, lng: 57.4760, severity: 'HIGH', area: 'Vacoas', reports: 15 },
  { id: 7, type: 'flood', lat: -20.1020, lng: 57.5560, severity: 'HIGH', area: 'Flacq', reports: 10 },
];

const HAZARD_ICONS = { pothole: '🕳️', flood: '🌊', accident: '💥', roadblock: '🚧', signal: '🚦', default: '📍' };
const HAZARD_COLORS = { pothole: '#E74C3C', flood: '#3498DB', accident: '#FF6B35', roadblock: '#F39C12', signal: '#9B59B6', default: '#95A5A6' };
const SEVERITY_COLORS = { HIGH: '#E74C3C', MEDIUM: '#F39C12', LOW: '#2ECC71' };

// Mauritius major places for stop search
const MAURITIUS_PLACES = [
  { name: 'Port Louis City Centre', lat: -20.1609, lng: 57.4992 },
  { name: 'Grand Baie Beach', lat: -20.0133, lng: 57.5833 },
  { name: 'Quatre Bornes', lat: -20.2651, lng: 57.4799 },
  { name: 'Curepipe', lat: -20.3168, lng: 57.5259 },
  { name: 'Rose Hill', lat: -20.2368, lng: 57.4592 },
  { name: 'Vacoas', lat: -20.2977, lng: 57.4785 },
  { name: 'Mahebourg', lat: -20.4037, lng: 57.7019 },
  { name: 'Flacq', lat: -20.1977, lng: 57.7119 },
  { name: 'Triolet', lat: -20.0474, lng: 57.5816 },
  { name: 'Goodlands', lat: -20.0300, lng: 57.6500 },
  { name: 'Souillac', lat: -20.5100, lng: 57.5200 },
  { name: 'Flic en Flac Beach', lat: -20.3050, lng: 57.3620 },
  { name: 'Blue Bay Beach', lat: -20.4500, lng: 57.7100 },
  { name: 'Tamarin', lat: -20.3300, lng: 57.3750 },
  { name: 'Trou aux Biches', lat: -20.0300, lng: 57.5400 },
  { name: 'Pamplemousses', lat: -20.1000, lng: 57.5800 },
  { name: 'Ebene Cybercity', lat: -20.2350, lng: 57.4960 },
  { name: 'SSR Airport', lat: -20.4302, lng: 57.6836 },
  { name: 'Caudan Waterfront', lat: -20.1580, lng: 57.4960 },
  { name: 'La Preneuse', lat: -20.3300, lng: 57.3600 },
  { name: 'Riviere du Rempart', lat: -20.1100, lng: 57.6600 },
  { name: 'Belle Mare', lat: -20.1900, lng: 57.7800 },
  { name: 'Trou d\'Eau Douce', lat: -20.2100, lng: 57.7900 },
  { name: 'Le Morne', lat: -20.4500, lng: 57.3200 },
];

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [hazards, setHazards] = useState(DEMO_HAZARDS);
  const [filter, setFilter] = useState('hazards');
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);

  // Route planner state
  const [stops, setStops] = useState([]);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [addingStopIndex, setAddingStopIndex] = useState(null);

  // Layers
  const [showTraffic, setShowTraffic] = useState(false);
  const [showBlackSpots, setShowBlackSpots] = useState(false);
  const [showSpeedZones, setShowSpeedZones] = useState(false);
  const [showHazards, setShowHazards] = useState(true);

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

  // Search places
  const searchPlaces = (text) => {
    setSearchText(text);
    if (text.length < 2) { setSearchResults([]); return; }
    const results = MAURITIUS_PLACES.filter(p =>
      p.name.toLowerCase().includes(text.toLowerCase())
    );
    setSearchResults(results);
  };

  // Add a stop to route
  const addStop = (place) => {
    const newStop = { ...place, id: Date.now() };
    if (addingStopIndex !== null) {
      const newStops = [...stops];
      newStops[addingStopIndex] = newStop;
      setStops(newStops);
      setAddingStopIndex(null);
    } else {
      setStops(prev => [...prev, newStop]);
    }
    setSearchText('');
    setSearchResults([]);

    // Fly to location on map
    mapRef.current?.animateToRegion({
      latitude: place.lat,
      longitude: place.lng,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    }, 800);
  };

  const removeStop = (index) => {
    setStops(stops.filter((_, i) => i !== index));
  };

  const moveStopUp = (index) => {
    if (index === 0) return;
    const newStops = [...stops];
    [newStops[index - 1], newStops[index]] = [newStops[index], newStops[index - 1]];
    setStops(newStops);
  };

  // Build route polyline from stops + current location
  const getRouteCoords = () => {
    const points = [];
    if (location) points.push({ latitude: location.latitude, longitude: location.longitude });
    stops.forEach(s => points.push({ latitude: s.lat, longitude: s.lng }));
    return points;
  };

  // Check hazards along route
  const getRouteWarnings = () => {
    if (stops.length === 0) return [];
    const warnings = [];
    ACCIDENT_BLACK_SPOTS.filter(b => b.severity === 'HIGH').forEach(spot => {
      stops.forEach(stop => {
        const dist = Math.sqrt((spot.lat - stop.lat) ** 2 + (spot.lng - stop.lng) ** 2);
        if (dist < 0.05) warnings.push(`⚠️ ${spot.name} is a known accident black spot near ${stop.name}`);
      });
    });
    return warnings;
  };

  const fitMapToRoute = () => {
    if (stops.length === 0) return;
    const allCoords = getRouteCoords();
    if (allCoords.length < 2) return;
    mapRef.current?.fitToCoordinates(allCoords, {
      edgePadding: { top: 80, right: 40, bottom: 200, left: 40 },
      animated: true,
    });
  };

  const routeWarnings = getRouteWarnings();
  const routeCoords = getRouteCoords();

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: -20.2744, longitude: 57.5512,
          latitudeDelta: 0.8, longitudeDelta: 0.8,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* ── LAYER 1: Road Hazards ── */}
        {showHazards && hazards.map((hazard) => (
          <React.Fragment key={hazard.id}>
            <Circle
              center={{ latitude: hazard.lat || hazard.latitude, longitude: hazard.lng || hazard.longitude }}
              radius={hazard.severity === 'HIGH' ? 800 : 500}
              strokeColor={SEVERITY_COLORS[hazard.severity] + '60'}
              fillColor={SEVERITY_COLORS[hazard.severity] + '20'}
            />
            <Marker coordinate={{ latitude: hazard.lat || hazard.latitude, longitude: hazard.lng || hazard.longitude }}>
              <View style={[styles.markerPin, { backgroundColor: HAZARD_COLORS[hazard.type] || '#95A5A6' }]}>
                <Text style={styles.markerEmoji}>{HAZARD_ICONS[hazard.type] || '📍'}</Text>
              </View>
              <Callout style={styles.callout}>
                <Text style={styles.calloutTitle}>{HAZARD_ICONS[hazard.type]} {hazard.type?.toUpperCase()}</Text>
                <Text style={styles.calloutArea}>📍 {hazard.area}</Text>
                <Text style={[styles.calloutSev, { color: SEVERITY_COLORS[hazard.severity] }]}>⚡ {hazard.severity}</Text>
                <Text style={styles.calloutSub}>👥 {hazard.reports} reports</Text>
              </Callout>
            </Marker>
          </React.Fragment>
        ))}

        {/* ── LAYER 2: Traffic congestion (colored circles at key roads) ── */}
        {showTraffic && TRAFFIC_SEGMENTS.map(seg => {
          const color = getTrafficColor(seg.avgSpeed, seg.freeFlowSpeed);
          return (
            <React.Fragment key={seg.id}>
              <Polyline
                coordinates={[
                  { latitude: seg.startLat, longitude: seg.startLng },
                  { latitude: seg.endLat, longitude: seg.endLng },
                ]}
                strokeColor={color}
                strokeWidth={6}
                lineDashPattern={seg.congestion === 'free' ? undefined : [1]}
              />
              <Marker coordinate={{ latitude: (seg.startLat + seg.endLat) / 2, longitude: (seg.startLng + seg.endLng) / 2 }}>
                <View style={[styles.trafficBadge, { backgroundColor: color }]}>
                  <Text style={styles.trafficText}>{seg.avgSpeed}km/h</Text>
                </View>
                <Callout style={styles.callout}>
                  <Text style={styles.calloutTitle}>🚦 {seg.name}</Text>
                  <Text style={styles.calloutArea}>Current: {seg.avgSpeed} km/h</Text>
                  <Text style={styles.calloutArea}>Normal: {seg.freeFlowSpeed} km/h</Text>
                  <Text style={[styles.calloutSev, { color }]}>Status: {seg.congestion.toUpperCase()}</Text>
                  <Text style={styles.calloutSub}>Based on crowdsourced data</Text>
                </Callout>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* ── LAYER 3: Accident Black Spots Heatmap ── */}
        {showBlackSpots && ACCIDENT_BLACK_SPOTS.map(spot => (
          <React.Fragment key={spot.id}>
            <Circle
              center={{ latitude: spot.lat, longitude: spot.lng }}
              radius={spot.severity === 'HIGH' ? 1200 : 800}
              strokeColor={spot.severity === 'HIGH' ? '#E74C3C80' : '#F39C1280'}
              fillColor={spot.severity === 'HIGH' ? '#E74C3C30' : '#F39C1220'}
            />
            <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }}>
              <View style={[styles.blackSpotMarker, { backgroundColor: spot.severity === 'HIGH' ? '#E74C3C' : '#F39C12' }]}>
                <Text style={styles.markerEmoji}>💀</Text>
              </View>
              <Callout style={styles.callout}>
                <Text style={styles.calloutTitle}>🔴 ACCIDENT BLACK SPOT</Text>
                <Text style={styles.calloutArea}>📍 {spot.name}</Text>
                <Text style={[styles.calloutSev, { color: SEVERITY_COLORS[spot.severity] }]}>⚡ {spot.severity} RISK</Text>
                <Text style={styles.calloutSub}>📊 {spot.accidents} recorded accidents</Text>
                <Text style={styles.calloutSub}>ℹ️ {spot.description}</Text>
              </Callout>
            </Marker>
          </React.Fragment>
        ))}

        {/* ── LAYER 4: Speed Zones ── */}
        {showSpeedZones && SPEED_ZONES.map(zone => {
          const color = zone.type === 'highway' ? '#3498DB' : zone.type === 'main' ? '#F39C12' : '#E74C3C';
          return (
            <React.Fragment key={zone.id}>
              <Circle
                center={{ latitude: zone.lat, longitude: zone.lng }}
                radius={zone.type === 'highway' ? 2000 : zone.type === 'main' ? 1200 : 600}
                strokeColor={color + '60'}
                fillColor={color + '15'}
              />
              <Marker coordinate={{ latitude: zone.lat, longitude: zone.lng }}>
                <View style={[styles.speedBadge, { backgroundColor: color }]}>
                  <Text style={styles.speedBadgeText}>{zone.limit}</Text>
                  <Text style={styles.speedBadgeUnit}>km/h</Text>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* ── Route stops ── */}
        {stops.map((stop, index) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
          >
            <View style={styles.stopMarker}>
              <Text style={styles.stopMarkerText}>{index + 1}</Text>
            </View>
            <Callout>
              <Text style={styles.calloutTitle}>Stop {index + 1}</Text>
              <Text style={styles.calloutArea}>{stop.name}</Text>
            </Callout>
          </Marker>
        ))}

        {/* Route line */}
        {routeCoords.length >= 2 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor="#3498DB"
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}

        {/* User location */}
        {location && (
          <Circle
            center={{ latitude: location.latitude, longitude: location.longitude }}
            radius={200}
            strokeColor="rgba(52,152,219,0.6)"
            fillColor="rgba(52,152,219,0.15)"
          />
        )}
      </MapView>

      {/* ── Top Layer Toggle Bar ── */}
      <View style={styles.layerBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerScroll}>
          <TouchableOpacity style={[styles.layerBtn, showHazards && styles.layerBtnOn]} onPress={() => setShowHazards(!showHazards)}>
            <Text style={[styles.layerText, showHazards && styles.layerTextOn]}>🕳️ Hazards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.layerBtn, showTraffic && styles.layerBtnTraffic]} onPress={() => setShowTraffic(!showTraffic)}>
            <Text style={[styles.layerText, showTraffic && styles.layerTextOn]}>🚦 Traffic</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.layerBtn, showBlackSpots && styles.layerBtnDanger]} onPress={() => setShowBlackSpots(!showBlackSpots)}>
            <Text style={[styles.layerText, showBlackSpots && styles.layerTextOn]}>💀 Black Spots</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.layerBtn, showSpeedZones && styles.layerBtnSpeed]} onPress={() => setShowSpeedZones(!showSpeedZones)}>
            <Text style={[styles.layerText, showSpeedZones && styles.layerTextOn]}>⚡ Speed Zones</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.layerBtn, showRoutePlanner && styles.layerBtnRoute]} onPress={() => setShowRoutePlanner(!showRoutePlanner)}>
            <Text style={[styles.layerText, showRoutePlanner && styles.layerTextOn]}>🗺️ Route</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Route Planner Panel ── */}
      {showRoutePlanner && (
        <View style={styles.routePanel}>
          <View style={styles.routePanelHeader}>
            <Text style={styles.routePanelTitle}>🗺️ Route Planner</Text>
            {stops.length >= 2 && (
              <TouchableOpacity style={styles.fitBtn} onPress={fitMapToRoute}>
                <Text style={styles.fitBtnText}>Fit map ↗</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search box */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search a place in Mauritius..."
            placeholderTextColor="#7f8c8d"
            value={searchText}
            onChangeText={searchPlaces}
          />

          {/* Search results */}
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.slice(0, 5).map((place, i) => (
                <TouchableOpacity key={i} style={styles.searchResult} onPress={() => addStop(place)}>
                  <Text style={styles.searchResultIcon}>📍</Text>
                  <Text style={styles.searchResultText}>{place.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Current location as start */}
          {location && (
            <View style={styles.stopRow}>
              <View style={[styles.stopDot, { backgroundColor: '#2ECC71' }]} />
              <Text style={styles.stopRowText}>📍 Your current location</Text>
            </View>
          )}

          {/* Stops list */}
          {stops.map((stop, index) => (
            <View key={stop.id} style={styles.stopRow}>
              <View style={[styles.stopDot, { backgroundColor: '#3498DB' }]}>
                <Text style={styles.stopDotNum}>{index + 1}</Text>
              </View>
              <Text style={styles.stopRowText} numberOfLines={1}>{stop.name}</Text>
              <View style={styles.stopActions}>
                {index > 0 && (
                  <TouchableOpacity onPress={() => moveStopUp(index)} style={styles.stopBtn}>
                    <Text style={styles.stopBtnText}>↑</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => removeStop(index)} style={[styles.stopBtn, { backgroundColor: '#E74C3C20' }]}>
                  <Text style={[styles.stopBtnText, { color: '#E74C3C' }]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {stops.length === 0 && (
            <Text style={styles.emptyRoute}>Search a place above to add your first stop</Text>
          )}

          {/* Route warnings */}
          {routeWarnings.length > 0 && (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚠️ Route Warnings</Text>
              {routeWarnings.map((w, i) => (
                <Text key={i} style={styles.warningText}>{w}</Text>
              ))}
            </View>
          )}

          {stops.length > 0 && routeWarnings.length === 0 && (
            <View style={[styles.warningBox, { borderColor: '#2ECC71' }]}>
              <Text style={[styles.warningTitle, { color: '#2ECC71' }]}>✅ No major black spots on route</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Traffic Legend ── */}
      {showTraffic && (
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Traffic</Text>
          <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#2ECC71' }]} /><Text style={styles.legendText}>Free flow</Text></View>
          <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#F39C12' }]} /><Text style={styles.legendText}>Moderate</Text></View>
          <View style={styles.legendRow}><View style={[styles.legendDot, { backgroundColor: '#E74C3C' }]} /><Text style={styles.legendText}>Heavy/Stop</Text></View>
        </View>
      )}

      {/* ── Stats Bar ── */}
      {!showRoutePlanner && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{hazards.length}</Text>
            <Text style={styles.statLbl}>Hazards</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: '#E74C3C' }]}>
              {ACCIDENT_BLACK_SPOTS.filter(b => b.severity === 'HIGH').length}
            </Text>
            <Text style={styles.statLbl}>Black Spots</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{TRAFFIC_SEGMENTS.filter(t => t.congestion === 'heavy' || t.congestion === 'standstill').length}</Text>
            <Text style={styles.statLbl}>Congested</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={fetchHazards}>
            <Text style={styles.refreshText}>{loading ? '⏳' : '🔄'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  layerBar: { position: 'absolute', top: 10, left: 0, right: 0 },
  layerScroll: { paddingHorizontal: 10, gap: 6 },
  layerBtn: {
    backgroundColor: 'rgba(26,26,46,0.92)', paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2d2d4e',
  },
  layerBtnOn: { backgroundColor: '#E74C3C', borderColor: '#E74C3C' },
  layerBtnTraffic: { backgroundColor: '#27AE60', borderColor: '#27AE60' },
  layerBtnDanger: { backgroundColor: '#C0392B', borderColor: '#C0392B' },
  layerBtnSpeed: { backgroundColor: '#2980B9', borderColor: '#2980B9' },
  layerBtnRoute: { backgroundColor: '#8E44AD', borderColor: '#8E44AD' },
  layerText: { color: '#bdc3c7', fontSize: 12, fontWeight: '600' },
  layerTextOn: { color: '#fff' },

  routePanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,13,26,0.97)', borderTopWidth: 1,
    borderTopColor: '#2d2d4e', padding: 14, maxHeight: '55%',
  },
  routePanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  routePanelTitle: { color: '#ecf0f1', fontSize: 15, fontWeight: '700' },
  fitBtn: { backgroundColor: '#3498DB20', padding: 6, borderRadius: 8 },
  fitBtnText: { color: '#3498DB', fontSize: 12, fontWeight: '600' },
  searchInput: {
    backgroundColor: '#1a1a2e', color: '#ecf0f1', borderRadius: 10,
    padding: 10, fontSize: 14, borderWidth: 1, borderColor: '#2d2d4e', marginBottom: 8,
  },
  searchResults: { backgroundColor: '#1a1a2e', borderRadius: 10, borderWidth: 1, borderColor: '#2d2d4e', marginBottom: 8 },
  searchResult: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#2d2d4e' },
  searchResultIcon: { fontSize: 16, marginRight: 8 },
  searchResultText: { color: '#ecf0f1', fontSize: 13 },

  stopRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#2d2d4e',
  },
  stopDot: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 10, flexShrink: 0,
  },
  stopDotNum: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stopRowText: { color: '#ecf0f1', fontSize: 13, flex: 1 },
  stopActions: { flexDirection: 'row', gap: 6 },
  stopBtn: {
    backgroundColor: '#1a1a2e', width: 28, height: 28,
    borderRadius: 6, justifyContent: 'center', alignItems: 'center',
  },
  stopBtnText: { color: '#bdc3c7', fontSize: 14, fontWeight: '700' },
  emptyRoute: { color: '#7f8c8d', fontSize: 13, textAlign: 'center', padding: 12 },
  warningBox: {
    marginTop: 8, padding: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#E74C3C', backgroundColor: '#E74C3C10',
  },
  warningTitle: { color: '#E74C3C', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  warningText: { color: '#bdc3c7', fontSize: 12, marginBottom: 2 },

  legend: {
    position: 'absolute', right: 10, top: 60,
    backgroundColor: 'rgba(13,13,26,0.92)', padding: 10,
    borderRadius: 10, borderWidth: 1, borderColor: '#2d2d4e',
  },
  legendTitle: { color: '#ecf0f1', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: '#bdc3c7', fontSize: 11 },

  statsBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,13,26,0.95)', flexDirection: 'row',
    padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#2d2d4e',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: 'bold', color: '#3498DB' },
  statLbl: { fontSize: 10, color: '#7f8c8d', marginTop: 2 },
  refreshBtn: { padding: 8 },
  refreshText: { fontSize: 20 },

  markerPin: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  markerEmoji: { fontSize: 16 },
  blackSpotMarker: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  trafficBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#fff' },
  trafficText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  speedBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  speedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  speedBadgeUnit: { color: '#ffffffaa', fontSize: 7 },
  stopMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  stopMarkerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  callout: { width: 200, padding: 8 },
  calloutTitle: { fontSize: 13, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  calloutArea: { fontSize: 12, color: '#555', marginBottom: 2 },
  calloutSev: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  calloutSub: { fontSize: 11, color: '#888' },
});