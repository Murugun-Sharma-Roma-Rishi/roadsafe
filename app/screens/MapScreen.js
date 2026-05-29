import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import MapView, { Marker, Circle, Callout, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import config from '../config';
import {
  ACCIDENT_BLACK_SPOTS,
  TRAFFIC_SEGMENTS,
  SPEED_ZONES,
  getTrafficColor,
} from '../data/mauritiusData';

const API_URL = config.API_URL;

// ─── Demo hazards: string IDs to prevent clashes with DB integer IDs ───────
const DEMO_HAZARDS = [
  { id: 'demo-1', type: 'pothole',   latitude: -20.1609, longitude: 57.4992, severity: 'HIGH',   area: 'Port Louis',    reports: 12 },
  { id: 'demo-2', type: 'flood',     latitude: -20.2368, longitude: 57.5165, severity: 'MEDIUM', area: 'Quatre Bornes', reports: 8  },
  { id: 'demo-3', type: 'accident',  latitude: -20.3484, longitude: 57.5012, severity: 'HIGH',   area: 'Rose Hill',     reports: 5  },
  { id: 'demo-4', type: 'pothole',   latitude: -20.0474, longitude: 57.5816, severity: 'LOW',    area: 'Triolet',       reports: 3  },
  { id: 'demo-5', type: 'roadblock', latitude: -20.4637, longitude: 57.4375, severity: 'MEDIUM', area: 'Mahebourg',     reports: 6  },
  { id: 'demo-6', type: 'pothole',   latitude: -20.2540, longitude: 57.4760, severity: 'HIGH',   area: 'Vacoas',        reports: 15 },
  { id: 'demo-7', type: 'flood',     latitude: -20.1020, longitude: 57.5560, severity: 'HIGH',   area: 'Flacq',         reports: 10 },
  { id: 'demo-8', type: 'accident',  latitude: -20.1950, longitude: 57.5830, severity: 'MEDIUM', area: 'Curepipe',      reports: 7  },
  { id: 'demo-9', type: 'debris',    latitude: -20.3900, longitude: 57.6100, severity: 'LOW',    area: 'Souillac',      reports: 2  },
  { id: 'demo-10', type: 'signal',   latitude: -20.1650, longitude: 57.4900, severity: 'MEDIUM', area: 'Port Louis N',  reports: 4  },
];

const HAZARD_ICONS = {
  pothole: '🕳️', flood: '🌊', accident: '💥',
  roadblock: '🚧', signal: '🚦', debris: '⚠️', default: '📍',
};
const HAZARD_COLORS = {
  pothole: '#E74C3C', flood: '#3498DB', accident: '#FF6B35',
  roadblock: '#F39C12', signal: '#9B59B6', debris: '#95A5A6', default: '#7f8c8d',
};
const SEVERITY_COLORS = { HIGH: '#E74C3C', MEDIUM: '#F39C12', LOW: '#2ECC71' };

// All hazard filter types shown in the top filter bar
const HAZARD_FILTERS = [
  { key: 'all',       label: 'All',       icon: '🗺️' },
  { key: 'pothole',   label: 'Potholes',  icon: '🕳️' },
  { key: 'flood',     label: 'Flood',     icon: '🌊' },
  { key: 'accident',  label: 'Accident',  icon: '💥' },
  { key: 'roadblock', label: 'Roadblock', icon: '🚧' },
  { key: 'debris',    label: 'Debris',    icon: '⚠️' },
  { key: 'signal',    label: 'Signal',    icon: '🚦' },
];

// Radius per hazard type: potholes = exact pin only
function getHazardRadius(type, severity) {
  if (type === 'pothole' || type === 'debris') return 0;
  if (type === 'accident') return severity === 'HIGH' ? 200 : 100;
  if (type === 'flood')    return severity === 'HIGH' ? 800 : 400;
  return severity === 'HIGH' ? 500 : severity === 'MEDIUM' ? 300 : 150;
}

// Mauritius places for route search
const MAURITIUS_PLACES = [
  { name: 'Port Louis City Centre',  lat: -20.1609, lng: 57.4992 },
  { name: 'Grand Baie Beach',        lat: -20.0133, lng: 57.5833 },
  { name: 'Quatre Bornes',           lat: -20.2651, lng: 57.4799 },
  { name: 'Curepipe',                lat: -20.3168, lng: 57.5259 },
  { name: 'Rose Hill',               lat: -20.2368, lng: 57.4592 },
  { name: 'Vacoas',                  lat: -20.2977, lng: 57.4785 },
  { name: 'Mahebourg',               lat: -20.4037, lng: 57.7019 },
  { name: 'Flacq',                   lat: -20.1977, lng: 57.7119 },
  { name: 'Triolet',                 lat: -20.0474, lng: 57.5816 },
  { name: 'Goodlands',               lat: -20.0300, lng: 57.6500 },
  { name: 'Souillac',                lat: -20.5100, lng: 57.5200 },
  { name: 'Flic en Flac Beach',      lat: -20.3050, lng: 57.3620 },
  { name: 'Blue Bay Beach',          lat: -20.4500, lng: 57.7100 },
  { name: 'Tamarin',                 lat: -20.3300, lng: 57.3750 },
  { name: 'Trou aux Biches',         lat: -20.0300, lng: 57.5400 },
  { name: 'Pamplemousses',           lat: -20.1000, lng: 57.5800 },
  { name: 'Ebene Cybercity',         lat: -20.2350, lng: 57.4960 },
  { name: 'SSR Airport',             lat: -20.4302, lng: 57.6836 },
  { name: 'Caudan Waterfront',       lat: -20.1580, lng: 57.4960 },
  { name: 'Belle Mare',              lat: -20.1900, lng: 57.7800 },
  { name: 'Le Morne',                lat: -20.4500, lng: 57.3200 },
  { name: 'KFC Grand Baie',          lat: -20.0167, lng: 57.5833 },
  { name: 'KFC Port Louis',          lat: -20.1620, lng: 57.4980 },
  { name: 'KFC Rose Hill',           lat: -20.2370, lng: 57.4600 },
  { name: 'KFC Curepipe',            lat: -20.3180, lng: 57.5240 },
  { name: 'KFC Phoenix',             lat: -20.2990, lng: 57.4900 },
  { name: 'Phoenix Mall',            lat: -20.3000, lng: 57.4950 },
  { name: 'Bagatelle Mall',          lat: -20.2400, lng: 57.4680 },
  { name: 'Cascavelle Mall',         lat: -20.3100, lng: 57.3800 },
];

// Fetch real road route via OSRM (free, no API key)
async function fetchOSRMRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.[0]) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    }
  } catch (e) {}
  return null;
}

// Is hazard within ~50m buffer of a route segment?
function isNearRoute(hazard, routeCoords, bufferDeg = 0.008) {
  const hLat = hazard.latitude;
  const hLng = hazard.longitude;
  if (!hLat || !hLng || routeCoords.length < 2) return false;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const aLat = routeCoords[i].latitude, aLng = routeCoords[i].longitude;
    const bLat = routeCoords[i + 1].latitude, bLng = routeCoords[i + 1].longitude;
    const minLat = Math.min(aLat, bLat) - bufferDeg;
    const maxLat = Math.max(aLat, bLat) + bufferDeg;
    const minLng = Math.min(aLng, bLng) - bufferDeg;
    const maxLng = Math.max(aLng, bLng) + bufferDeg;
    if (hLat >= minLat && hLat <= maxLat && hLng >= minLng && hLng <= maxLng) return true;
  }
  return false;
}

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [allHazards, setAllHazards] = useState(DEMO_HAZARDS);
  const [hazardFilter, setHazardFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);

  // Layer toggles
  const [showHazards,    setShowHazards]    = useState(true);
  const [showTraffic,    setShowTraffic]    = useState(false);
  const [showBlackSpots, setShowBlackSpots] = useState(false);
  const [showSpeedZones, setShowSpeedZones] = useState(false);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);

  // Route planner
  const [stops,          setStops]          = useState([]);
  const [searchText,     setSearchText]     = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [routePolylines, setRoutePolylines] = useState([]); // array of coord arrays between stops
  const [routeHazards,   setRouteHazards]   = useState(null); // null = show all; array = filtered
  const [loadingRoute,   setLoadingRoute]   = useState(false);

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
      const [hazRes, repRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/hazards`),
        axios.get(`${API_URL}/api/reports`),
      ]);

      const hazardData = hazRes.status === 'fulfilled' && hazRes.value.data?.length > 0
        ? hazRes.value.data.map(h => ({
            ...h,
            id: `hazard-${h.id}`,
            latitude: h.latitude ?? h.lat,
            longitude: h.longitude ?? h.lng,
          }))
        : [];

      const reportData = repRes.status === 'fulfilled' && repRes.value.data?.length > 0
        ? repRes.value.data
            .filter(r => r.latitude && r.longitude)
            .map(r => ({ ...r, id: `report-${r.id}`, _isReport: true }))
        : [];

      const merged = [...DEMO_HAZARDS, ...hazardData, ...reportData];
      const seen = new Set();
      setAllHazards(merged.filter(h => { if (seen.has(h.id)) return false; seen.add(h.id); return true; }));
    } catch (e) {}
    setLoading(false);
  };

  // ─── Hazard filtering ───────────────────────────────────────────────────
  const visibleHazards = (() => {
    const base = routeHazards !== null ? routeHazards : allHazards;
    return hazardFilter === 'all' ? base : base.filter(h => h.type === hazardFilter);
  })();

  // ─── Route planner ──────────────────────────────────────────────────────
  const searchPlaces = (text) => {
    setSearchText(text);
    if (text.length < 2) { setSearchResults([]); return; }
    setSearchResults(
      MAURITIUS_PLACES.filter(p => p.name.toLowerCase().includes(text.toLowerCase())).slice(0, 6)
    );
  };

  const addStop = async (place) => {
    Keyboard.dismiss();
    setSearchText('');
    setSearchResults([]);

    const newStops = [...stops, { ...place, id: `stop-${Date.now()}` }];
    setStops(newStops);

    // Fly to place
    mapRef.current?.animateToRegion({
      latitude: place.lat, longitude: place.lng,
      latitudeDelta: 0.05, longitudeDelta: 0.05,
    }, 600);

    // Build real routes if we have at least origin + 1 stop
    await buildRoutes(newStops);
  };

  const removeStop = async (index) => {
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops);
    await buildRoutes(newStops);
    if (newStops.length === 0) setRouteHazards(null);
  };

  const moveStopUp = async (index) => {
    if (index === 0) return;
    const newStops = [...stops];
    [newStops[index - 1], newStops[index]] = [newStops[index], newStops[index - 1]];
    setStops(newStops);
    await buildRoutes(newStops);
  };

  const buildRoutes = async (currentStops) => {
    if (currentStops.length === 0) { setRoutePolylines([]); setRouteHazards(null); return; }
    setLoadingRoute(true);

    const waypoints = [];
    if (location) waypoints.push({ lat: location.latitude, lng: location.longitude });
    currentStops.forEach(s => waypoints.push({ lat: s.lat, lng: s.lng }));

    const polylines = [];
    const allRouteCoords = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const coords = await fetchOSRMRoute(waypoints[i], waypoints[i + 1]);
      if (coords) {
        polylines.push(coords);
        allRouteCoords.push(...coords);
      } else {
        // Fallback straight line
        const fallback = [
          { latitude: waypoints[i].lat, longitude: waypoints[i].lng },
          { latitude: waypoints[i + 1].lat, longitude: waypoints[i + 1].lng },
        ];
        polylines.push(fallback);
        allRouteCoords.push(...fallback);
      }
    }

    setRoutePolylines(polylines);

    // Filter hazards near the route
    if (allRouteCoords.length > 1) {
      setRouteHazards(allHazards.filter(h => isNearRoute(h, allRouteCoords)));
    }

    // Fit map
    if (allRouteCoords.length > 1) {
      mapRef.current?.fitToCoordinates(allRouteCoords, {
        edgePadding: { top: 120, right: 40, bottom: 280, left: 40 },
        animated: true,
      });
    }

    setLoadingRoute(false);
  };

  const clearRoute = () => {
    setStops([]);
    setRoutePolylines([]);
    setRouteHazards(null);
    setSearchText('');
    setSearchResults([]);
  };

  const routeWarnings = ACCIDENT_BLACK_SPOTS.filter(bs =>
    stops.some(stop => Math.abs(bs.lat - stop.lat) < 0.05 && Math.abs(bs.lng - stop.lng) < 0.05)
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ latitude: -20.2744, longitude: 57.5512, latitudeDelta: 0.8, longitudeDelta: 0.8 }}
        showsUserLocation
        showsMyLocationButton
      >
        {/* ── Hazard circles (non-pothole/debris) ── */}
        {showHazards && visibleHazards.map(h => {
          const radius = getHazardRadius(h.type, h.severity);
          if (!radius) return null;
          return (
            <Circle
              key={`circle-${h.id}`}
              center={{ latitude: h.latitude, longitude: h.longitude }}
              radius={radius}
              strokeColor={(SEVERITY_COLORS[h.severity] || '#aaa') + '80'}
              fillColor={(SEVERITY_COLORS[h.severity] || '#aaa') + '25'}
            />
          );
        })}

        {/* ── Hazard markers ── */}
        {showHazards && visibleHazards.map(h => {
          if (!h.latitude || !h.longitude) return null;
          return (
            <Marker
              key={`marker-${h.id}`}
              coordinate={{ latitude: h.latitude, longitude: h.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[
                styles.markerPin,
                { backgroundColor: HAZARD_COLORS[h.type] || '#7f8c8d' },
                h._isReport && styles.reportBorder,
              ]}>
                <Text style={styles.markerEmoji}>{HAZARD_ICONS[h.type] || '📍'}</Text>
                {h._isReport && (
                  <View style={styles.reportBadge}><Text style={styles.reportBadgeText}>!</Text></View>
                )}
              </View>
              <Callout style={styles.callout}>
                <Text style={styles.calloutTitle}>{HAZARD_ICONS[h.type]} {h.type?.toUpperCase()}{h._isReport ? ' (Reported)' : ''}</Text>
                {h.area ? <Text style={styles.calloutSub}>📍 {h.area}</Text> : null}
                <Text style={[styles.calloutSev, { color: SEVERITY_COLORS[h.severity] }]}>⚡ {h.severity}</Text>
                <Text style={styles.calloutSub}>👥 {h.reports || 1} report(s)</Text>
                <Text style={styles.calloutCoords}>{Number(h.latitude).toFixed(5)}, {Number(h.longitude).toFixed(5)}</Text>
              </Callout>
            </Marker>
          );
        })}

        {/* ── Traffic segments ── */}
        {showTraffic && TRAFFIC_SEGMENTS.map(seg => {
          const color = getTrafficColor(seg.avgSpeed, seg.freeFlowSpeed);
          const midLat = (seg.startLat + seg.endLat) / 2;
          const midLng = (seg.startLng + seg.endLng) / 2;
          return (
            <React.Fragment key={`traffic-${seg.id}`}>
              <Polyline
                coordinates={[
                  { latitude: seg.startLat, longitude: seg.startLng },
                  { latitude: seg.endLat,   longitude: seg.endLng   },
                ]}
                strokeColor={color} strokeWidth={6}
              />
              <Marker coordinate={{ latitude: midLat, longitude: midLng }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.trafficBadge, { backgroundColor: color }]}>
                  <Text style={styles.trafficText}>{seg.avgSpeed}km/h</Text>
                </View>
                <Callout style={styles.callout}>
                  <Text style={styles.calloutTitle}>🚦 {seg.name}</Text>
                  <Text style={styles.calloutSub}>Now: {seg.avgSpeed} km/h · Normal: {seg.freeFlowSpeed} km/h</Text>
                  <Text style={[styles.calloutSev, { color }]}>{seg.congestion.toUpperCase()}</Text>
                </Callout>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* ── Accident black spots ── */}
        {showBlackSpots && ACCIDENT_BLACK_SPOTS.map(spot => (
          <React.Fragment key={`bs-${spot.id}`}>
            <Circle
              center={{ latitude: spot.lat, longitude: spot.lng }}
              radius={spot.severity === 'HIGH' ? 1200 : 800}
              strokeColor={spot.severity === 'HIGH' ? '#E74C3C80' : '#F39C1280'}
              fillColor={spot.severity  === 'HIGH' ? '#E74C3C20' : '#F39C1215'}
            />
            <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.markerPin, { backgroundColor: spot.severity === 'HIGH' ? '#E74C3C' : '#F39C12' }]}>
                <Text style={styles.markerEmoji}>💀</Text>
              </View>
              <Callout style={styles.callout}>
                <Text style={styles.calloutTitle}>🔴 BLACK SPOT</Text>
                <Text style={styles.calloutSub}>📍 {spot.name}</Text>
                <Text style={[styles.calloutSev, { color: SEVERITY_COLORS[spot.severity] }]}>⚡ {spot.severity}</Text>
                <Text style={styles.calloutSub}>📊 {spot.accidents} accidents</Text>
                <Text style={styles.calloutSub}>{spot.description}</Text>
              </Callout>
            </Marker>
          </React.Fragment>
        ))}

        {/* ── Speed zones ── */}
        {showSpeedZones && SPEED_ZONES.map(zone => {
          const color = zone.type === 'highway' ? '#3498DB' : zone.type === 'main' ? '#F39C12' : '#E74C3C';
          return (
            <React.Fragment key={`sz-${zone.id}`}>
              <Circle
                center={{ latitude: zone.lat, longitude: zone.lng }}
                radius={zone.type === 'highway' ? 2000 : zone.type === 'main' ? 1200 : 600}
                strokeColor={color + '60'} fillColor={color + '15'}
              />
              <Marker coordinate={{ latitude: zone.lat, longitude: zone.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[styles.speedBadge, { backgroundColor: color }]}>
                  <Text style={styles.speedBadgeNum}>{zone.limit}</Text>
                  <Text style={styles.speedBadgeUnit}>km/h</Text>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* ── Stop markers ── */}
        {stops.map((stop, i) => (
          <Marker key={stop.id} coordinate={{ latitude: stop.lat, longitude: stop.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.stopMarker}>
              <Text style={styles.stopMarkerText}>{i + 1}</Text>
            </View>
            <Callout style={styles.callout}>
              <Text style={styles.calloutTitle}>Stop {i + 1}</Text>
              <Text style={styles.calloutSub}>{stop.name}</Text>
            </Callout>
          </Marker>
        ))}

        {/* ── Route polylines (real road routes) ── */}
        {routePolylines.map((coords, i) => (
          <Polyline key={`route-${i}`} coordinates={coords} strokeColor="#3498DB" strokeWidth={4} />
        ))}
      </MapView>

      {/* ── TOP BAR: Layer toggles ── */}
      <View style={styles.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topBarScroll}>
          <TouchableOpacity style={[styles.layerBtn, showHazards    && styles.layerOn]}    onPress={() => setShowHazards(!showHazards)}>
            <Text style={[styles.layerText, showHazards    && styles.layerTextOn]}>🕳️ Hazards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.layerBtn, showTraffic    && styles.layerTraffic]}  onPress={() => setShowTraffic(!showTraffic)}>
            <Text style={[styles.layerText, showTraffic    && styles.layerTextOn]}>🚦 Traffic</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.layerBtn, showBlackSpots && styles.layerDanger]}  onPress={() => setShowBlackSpots(!showBlackSpots)}>
            <Text style={[styles.layerText, showBlackSpots && styles.layerTextOn]}>💀 Black Spots</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.layerBtn, showSpeedZones && styles.layerSpeed]}   onPress={() => setShowSpeedZones(!showSpeedZones)}>
            <Text style={[styles.layerText, showSpeedZones && styles.layerTextOn]}>⚡ Speed Zones</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.layerBtn, showRoutePlanner && styles.layerRoute]} onPress={() => setShowRoutePlanner(!showRoutePlanner)}>
            <Text style={[styles.layerText, showRoutePlanner && styles.layerTextOn]}>🗺️ Route</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── HAZARD TYPE FILTER BAR (shown when Hazards layer is on & route planner is off) ── */}
      {showHazards && !showRoutePlanner && (
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {HAZARD_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterBtn, hazardFilter === f.key && styles.filterBtnActive]}
                onPress={() => setHazardFilter(f.key)}
              >
                <Text style={[styles.filterText, hazardFilter === f.key && styles.filterTextActive]}>
                  {f.icon} {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── ROUTE PANEL (keyboard-aware) ── */}
      {showRoutePlanner && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.routeKAV}
          keyboardVerticalOffset={0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.routePanel}>
              {/* Header */}
              <View style={styles.routeHeader}>
                <Text style={styles.routeTitle}>
                  🗺️ Route Planner
                  {loadingRoute ? '  ⏳' : routeHazards !== null ? `  ⚠️ ${routeHazards.length} hazards on route` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {stops.length > 0 && (
                    <TouchableOpacity style={styles.clearBtn} onPress={clearRoute}>
                      <Text style={styles.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.fitBtn} onPress={() => {
                    if (routePolylines.flat().length > 1) {
                      mapRef.current?.fitToCoordinates(routePolylines.flat(), {
                        edgePadding: { top: 120, right: 40, bottom: 280, left: 40 }, animated: true,
                      });
                    }
                  }}>
                    <Text style={styles.fitBtnText}>Fit ↗</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search input */}
              <TextInput
                style={styles.searchInput}
                placeholder="Search stop (e.g. KFC Grand Baie, Curepipe...)"
                placeholderTextColor="#7f8c8d"
                value={searchText}
                onChangeText={searchPlaces}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <View style={styles.searchDropdown}>
                  {searchResults.map((place, i) => (
                    <TouchableOpacity
                      key={`result-${i}`}
                      style={[styles.searchResult, i < searchResults.length - 1 && styles.searchResultBorder]}
                      onPress={() => addStop(place)}
                    >
                      <Text style={styles.searchResultIcon}>📍</Text>
                      <Text style={styles.searchResultText}>{place.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Current location row */}
              {location && (
                <View style={styles.stopRow}>
                  <View style={[styles.stopDot, { backgroundColor: '#2ECC71' }]} />
                  <Text style={styles.stopRowText}>📍 Your location (start)</Text>
                </View>
              )}

              {/* Stops list */}
              {stops.map((stop, i) => (
                <View key={stop.id} style={styles.stopRow}>
                  <View style={[styles.stopDot, { backgroundColor: i === stops.length - 1 ? '#E74C3C' : '#3498DB' }]}>
                    <Text style={styles.stopDotNum}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stopRowText} numberOfLines={1}>{stop.name}</Text>
                  <View style={styles.stopActions}>
                    {i > 0 && (
                      <TouchableOpacity onPress={() => moveStopUp(i)} style={styles.stopBtn}>
                        <Text style={styles.stopBtnText}>↑</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => removeStop(i)} style={[styles.stopBtn, { backgroundColor: '#E74C3C20' }]}>
                      <Text style={[styles.stopBtnText, { color: '#E74C3C' }]}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {stops.length === 0 && (
                <Text style={styles.emptyRoute}>Search a place above to add your first stop</Text>
              )}

              {/* Warnings */}
              {routeWarnings.length > 0 && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningTitle}>⚠️ Black spots near route</Text>
                  {routeWarnings.map((w, i) => (
                    <Text key={`warn-${i}`} style={styles.warningText}>• {w.name} ({w.accidents} accidents)</Text>
                  ))}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {/* ── Traffic legend ── */}
      {showTraffic && !showRoutePlanner && (
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Traffic</Text>
          {[['#2ECC71','Free flow'],['#F39C12','Moderate'],['#E74C3C','Heavy']].map(([c, l]) => (
            <View key={l} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: c }]} />
              <Text style={styles.legendText}>{l}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Stats bar ── */}
      {!showRoutePlanner && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{visibleHazards.length}</Text>
            <Text style={styles.statLbl}>Hazards</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: '#E74C3C' }]}>
              {ACCIDENT_BLACK_SPOTS.filter(b => b.severity === 'HIGH').length}
            </Text>
            <Text style={styles.statLbl}>Black Spots</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>
              {TRAFFIC_SEGMENTS.filter(t => t.congestion === 'heavy' || t.congestion === 'standstill').length}
            </Text>
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

  // Top layer bar
  topBar: { position: 'absolute', top: 10, left: 0, right: 0 },
  topBarScroll: { paddingHorizontal: 10, gap: 6 },
  layerBtn: {
    backgroundColor: 'rgba(26,26,46,0.92)', paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2d2d4e',
  },
  layerOn:      { backgroundColor: '#E74C3C', borderColor: '#E74C3C' },
  layerTraffic: { backgroundColor: '#27AE60', borderColor: '#27AE60' },
  layerDanger:  { backgroundColor: '#C0392B', borderColor: '#C0392B' },
  layerSpeed:   { backgroundColor: '#2980B9', borderColor: '#2980B9' },
  layerRoute:   { backgroundColor: '#8E44AD', borderColor: '#8E44AD' },
  layerText:    { color: '#bdc3c7', fontSize: 12, fontWeight: '600' },
  layerTextOn:  { color: '#fff' },

  // Hazard type filter bar (second row)
  filterBar: { position: 'absolute', top: 54, left: 0, right: 0 },
  filterScroll: { paddingHorizontal: 10, gap: 6 },
  filterBtn: {
    backgroundColor: 'rgba(13,13,26,0.88)', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#2d2d4e',
  },
  filterBtnActive: { backgroundColor: '#3498DB', borderColor: '#3498DB' },
  filterText:      { color: '#bdc3c7', fontSize: 11, fontWeight: '600' },
  filterTextActive:{ color: '#fff' },

  // Route planner
  routeKAV: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  routePanel: {
    backgroundColor: 'rgba(13,13,26,0.97)', borderTopWidth: 1,
    borderTopColor: '#3498DB', padding: 14, maxHeight: 380,
  },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  routeTitle: { color: '#ecf0f1', fontSize: 14, fontWeight: '700', flex: 1 },
  fitBtn: { backgroundColor: '#3498DB20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  fitBtnText: { color: '#3498DB', fontSize: 12, fontWeight: '600' },
  clearBtn: { backgroundColor: '#E74C3C20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  clearBtnText: { color: '#E74C3C', fontSize: 12, fontWeight: '600' },
  searchInput: {
    backgroundColor: '#1a1a2e', color: '#ecf0f1', borderRadius: 10,
    padding: 11, fontSize: 14, borderWidth: 1, borderColor: '#2d2d4e', marginBottom: 6,
  },
  searchDropdown: {
    backgroundColor: '#1a1a2e', borderRadius: 10,
    borderWidth: 1, borderColor: '#2d2d4e', marginBottom: 8,
  },
  searchResult: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  searchResultBorder: { borderBottomWidth: 1, borderBottomColor: '#2d2d4e' },
  searchResultIcon: { fontSize: 14, marginRight: 8 },
  searchResultText: { color: '#ecf0f1', fontSize: 13 },
  stopRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2d2d4e',
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
  warningText:  { color: '#bdc3c7', fontSize: 12, marginBottom: 2 },

  // Traffic legend
  legend: {
    position: 'absolute', right: 10, top: 100,
    backgroundColor: 'rgba(13,13,26,0.92)', padding: 10,
    borderRadius: 10, borderWidth: 1, borderColor: '#2d2d4e',
  },
  legendTitle: { color: '#ecf0f1', fontSize: 11, fontWeight: '700', marginBottom: 6 },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  legendDot:   { width: 12, height: 12, borderRadius: 6 },
  legendText:  { color: '#bdc3c7', fontSize: 11 },

  // Stats bar
  statsBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,13,26,0.95)', flexDirection: 'row',
    padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#2d2d4e',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNum:  { fontSize: 20, fontWeight: 'bold', color: '#3498DB' },
  statLbl:  { fontSize: 10, color: '#7f8c8d', marginTop: 2 },
  refreshBtn: { padding: 8 },
  refreshText: { fontSize: 20 },

  // Markers
  markerPin: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  reportBorder: { borderColor: '#FFD700', borderWidth: 3 },
  reportBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#FFD700', borderRadius: 8,
    width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  reportBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#000' },
  markerEmoji: { fontSize: 16 },
  trafficBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#fff' },
  trafficText:  { color: '#fff', fontSize: 10, fontWeight: '700' },
  speedBadge:   { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  speedBadgeNum:  { color: '#fff', fontSize: 11, fontWeight: '700' },
  speedBadgeUnit: { color: '#ffffffaa', fontSize: 7 },
  stopMarker: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#3498DB',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff',
  },
  stopMarkerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  callout: { width: 200, padding: 8 },
  calloutTitle: { fontSize: 13, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  calloutSub:   { fontSize: 12, color: '#555', marginBottom: 2 },
  calloutSev:   { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  calloutCoords:{ fontSize: 10, color: '#aaa', marginTop: 2, fontFamily: 'monospace' },
});