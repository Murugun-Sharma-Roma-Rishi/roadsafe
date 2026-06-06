import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard,
  TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Circle, Callout, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import config from '../config';
import {
  ACCIDENT_BLACK_SPOTS,
  TRAFFIC_SEGMENTS,
  SPEED_ZONES,
  MAURITIUS_PLACES,
  getTrafficColor,
} from '../data/mauritiusData';

const API_URL = config.API_URL;

// ─── Demo hazards ──────────────────────────────────────────────────────────
const DEMO_HAZARDS = [
  { id: 'demo-1',  type: 'pothole',   latitude: -20.1609, longitude: 57.4992, severity: 'HIGH',   area: 'Port Louis',    reports: 12 },
  { id: 'demo-2',  type: 'flood',     latitude: -20.2368, longitude: 57.5165, severity: 'MEDIUM', area: 'Quatre Bornes', reports: 8  },
  { id: 'demo-3',  type: 'accident',  latitude: -20.3484, longitude: 57.5012, severity: 'HIGH',   area: 'Rose Hill',     reports: 5  },
  { id: 'demo-4',  type: 'pothole',   latitude: -20.0474, longitude: 57.5816, severity: 'LOW',    area: 'Triolet',       reports: 3  },
  { id: 'demo-5',  type: 'roadblock', latitude: -20.4637, longitude: 57.4375, severity: 'MEDIUM', area: 'Mahebourg',     reports: 6  },
  { id: 'demo-6',  type: 'pothole',   latitude: -20.2540, longitude: 57.4760, severity: 'HIGH',   area: 'Vacoas',        reports: 15 },
  { id: 'demo-7',  type: 'flood',     latitude: -20.1020, longitude: 57.5560, severity: 'HIGH',   area: 'Flacq',         reports: 10 },
  { id: 'demo-8',  type: 'accident',  latitude: -20.1950, longitude: 57.5830, severity: 'MEDIUM', area: 'Curepipe',      reports: 7  },
  { id: 'demo-9',  type: 'debris',    latitude: -20.3900, longitude: 57.6100, severity: 'LOW',    area: 'Souillac',      reports: 2  },
  { id: 'demo-10', type: 'signal',    latitude: -20.1650, longitude: 57.4900, severity: 'MEDIUM', area: 'Port Louis N',  reports: 4  },
];

const HAZARD_ICONS   = { pothole:'🕳️', flood:'🌊', accident:'💥', roadblock:'🚧', signal:'🚦', debris:'⚠️', default:'📍' };
const HAZARD_COLORS  = { pothole:'#E74C3C', flood:'#3498DB', accident:'#FF6B35', roadblock:'#F39C12', signal:'#9B59B6', debris:'#95A5A6', default:'#7f8c8d' };
const SEVERITY_COLORS = { HIGH:'#E74C3C', MEDIUM:'#F39C12', LOW:'#2ECC71' };

const HAZARD_FILTERS = [
  { key:'all',       label:'All',       icon:'🗺️' },
  { key:'pothole',   label:'Potholes',  icon:'🕳️' },
  { key:'flood',     label:'Flood',     icon:'🌊' },
  { key:'accident',  label:'Accident',  icon:'💥' },
  { key:'roadblock', label:'Roadblock', icon:'🚧' },
  { key:'debris',    label:'Debris',    icon:'⚠️' },
  { key:'signal',    label:'Signal',    icon:'🚦' },
];

function getHazardRadius(type, severity) {
  if (type === 'pothole' || type === 'debris') return 0;
  if (type === 'accident') return severity === 'HIGH' ? 200 : 100;
  if (type === 'flood')    return severity === 'HIGH' ? 600 : 300;
  return severity === 'HIGH' ? 400 : severity === 'MEDIUM' ? 250 : 120;
}

// Fetch road-following route via OSRM (free, no API key)
async function fetchOSRMRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.routes?.[0]) {
      const route = data.routes[0];
      return {
        coords:   route.geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
        distance: (route.distance / 1000).toFixed(1),
        duration: Math.round(route.duration / 60),
        steps:    (route.legs?.[0]?.steps || []).map(s => s.maneuver?.instruction).filter(Boolean),
      };
    }
  } catch (e) {}
  return null;
}

// FIX 1: Fetch road-snapped geometry for a traffic segment via OSRM
async function fetchSegmentRoadCoords(seg) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${seg.startLng},${seg.startLat};${seg.endLng},${seg.endLat}?overview=full&geometries=geojson`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.routes?.[0]) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    }
  } catch (e) {}
  // Fallback to straight line if OSRM unavailable
  return [
    { latitude: seg.startLat, longitude: seg.startLng },
    { latitude: seg.endLat,   longitude: seg.endLng   },
  ];
}

function isNearRoute(hazard, routeCoords, bufferDeg = 0.0007) {
  if (!hazard.latitude || !hazard.longitude || routeCoords.length < 2) return false;
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const a = routeCoords[i], b = routeCoords[i + 1];
    const minLat = Math.min(a.latitude,  b.latitude)  - bufferDeg;
    const maxLat = Math.max(a.latitude,  b.latitude)  + bufferDeg;
    const minLng = Math.min(a.longitude, b.longitude) - bufferDeg;
    const maxLng = Math.max(a.longitude, b.longitude) + bufferDeg;
    if (hazard.latitude  >= minLat && hazard.latitude  <= maxLat &&
        hazard.longitude >= minLng && hazard.longitude <= maxLng) return true;
  }
  return false;
}

// Check if a traffic segment overlaps the active route (within ~500m buffer)
function segmentOverlapsRoute(seg, routeCoords, bufferDeg = 0.005) {
  if (!routeCoords || routeCoords.length < 2) return false;
  const midLat = (seg.startLat + seg.endLat) / 2;
  const midLng = (seg.startLng + seg.endLng) / 2;
  for (const pt of routeCoords) {
    const dist = Math.sqrt((pt.latitude - midLat) ** 2 + (pt.longitude - midLng) ** 2);
    if (dist < bufferDeg) return true;
  }
  return false;
}

export default function MapScreen() {
  const [location,        setLocation]        = useState(null);
  const [allHazards,      setAllHazards]      = useState(DEMO_HAZARDS);
  const [hazardFilter,    setHazardFilter]    = useState('all');
  const [loading,         setLoading]         = useState(false);
  const mapRef = useRef(null);

  // Layer toggles — FIX 2: removed showTraffic toggle; traffic now auto-shows with route
  const [showHazards,      setShowHazards]      = useState(true);
  const [showBlackSpots,   setShowBlackSpots]   = useState(false);
  const [showSpeedZones,   setShowSpeedZones]   = useState(false);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);

  // Route planner
  const [stops,          setStops]          = useState([]);
  const [searchText,     setSearchText]     = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [routeSegments,  setRouteSegments]  = useState([]);
  const [routeHazards,   setRouteHazards]   = useState(null);
  const [loadingRoute,   setLoadingRoute]   = useState(false);

  // FIX 3: Custom start point
  const [customStart,       setCustomStart]       = useState(null); // null = use GPS location
  const [startSearchText,   setStartSearchText]   = useState('');
  const [startSearchResults,setStartSearchResults]= useState([]);
  const [editingStart,      setEditingStart]       = useState(false);

  // FIX 1: Road-snapped geometry for traffic segments
  const [trafficRoadCoords, setTrafficRoadCoords] = useState({}); // { segId: [{latitude, longitude}] }
  const trafficCoordsLoaded = useRef(false);

  // Live user speed — updates traffic segments
  const [liveTraffic,  setLiveTraffic] = useState(TRAFFIC_SEGMENTS);

  // All route coords combined (for traffic overlay)
  const allRouteCoords = routeSegments.flatMap(s => s.coords);

  useEffect(() => {
    getLocation();
    fetchHazards();
    loadTrafficRoadCoords(); // FIX 1: load road geometry for traffic segments
  }, []);

  // FIX 1: Load OSRM road geometry for all traffic segments
  const loadTrafficRoadCoords = async () => {
    if (trafficCoordsLoaded.current) return;
    trafficCoordsLoaded.current = true;
    const results = {};
    // Load in batches to avoid hammering OSRM
    for (const seg of TRAFFIC_SEGMENTS) {
      results[seg.id] = await fetchSegmentRoadCoords(seg);
      // Small delay to be polite to free OSRM server
      await new Promise(r => setTimeout(r, 100));
    }
    setTrafficRoadCoords(results);
  };

  // ─── Location + live traffic update ──────────────────────────────────────
  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 100 },
      (newLoc) => {
        setLocation(newLoc.coords);
        const spd = newLoc.coords.speed ? Math.max(0, newLoc.coords.speed * 3.6) : null;
        if (spd !== null) updateLiveTraffic(newLoc.coords, spd);
      }
    );
  };

  const updateLiveTraffic = (coords, userSpeed) => {
    setLiveTraffic(prev => {
      const updated = [...prev];
      let nearest = null, minDist = Infinity;
      for (const seg of updated) {
        const midLat = (seg.startLat + seg.endLat) / 2;
        const midLng = (seg.startLng + seg.endLng) / 2;
        const dist = Math.sqrt((coords.latitude - midLat) ** 2 + (coords.longitude - midLng) ** 2);
        if (dist < minDist) { minDist = dist; nearest = seg; }
      }
      if (nearest && minDist < 0.05) {
        const idx = updated.findIndex(s => s.id === nearest.id);
        if (idx >= 0) {
          const blended = Math.round(updated[idx].avgSpeed * 0.7 + userSpeed * 0.3);
          const ratio = blended / updated[idx].freeFlowSpeed;
          const congestion = ratio > 0.75 ? 'free' : ratio > 0.50 ? 'moderate' : ratio > 0.25 ? 'heavy' : 'standstill';
          updated[idx] = { ...updated[idx], avgSpeed: blended, congestion };
        }
      }
      return updated;
    });
  };

  const fetchHazards = async () => {
    setLoading(true);
    try {
      const [hazRes, repRes] = await Promise.allSettled([
        axios.get(`${API_URL}/api/hazards`),
        axios.get(`${API_URL}/api/reports`),
      ]);
      const hazardData = hazRes.status === 'fulfilled' && hazRes.value.data?.length > 0
        ? hazRes.value.data.map(h => ({ ...h, id: `hazard-${h.id}`, latitude: h.latitude ?? h.lat, longitude: h.longitude ?? h.lng }))
        : [];
      const reportData = repRes.status === 'fulfilled' && repRes.value.data?.length > 0
        ? repRes.value.data.filter(r => r.latitude && r.longitude).map(r => ({ ...r, id: `report-${r.id}`, _isReport: true }))
        : [];
      const merged = [...DEMO_HAZARDS, ...hazardData, ...reportData];
      const seen = new Set();
      setAllHazards(merged.filter(h => { if (seen.has(h.id)) return false; seen.add(h.id); return true; }));
    } catch (e) {}
    setLoading(false);
  };

  // ─── Visible hazards ──────────────────────────────────────────────────────
  const visibleHazards = (() => {
    const base = routeHazards !== null ? routeHazards : allHazards;
    return hazardFilter === 'all' ? base : base.filter(h => h.type === hazardFilter);
  })();

  // ─── Route planner ────────────────────────────────────────────────────────
  const searchPlaces = (text) => {
    setSearchText(text);
    if (text.length < 2) { setSearchResults([]); return; }
    setSearchResults(
      MAURITIUS_PLACES.filter(p => p.name.toLowerCase().includes(text.toLowerCase())).slice(0, 7)
    );
  };

  // FIX 3: Search for custom start point
  const searchStartPlaces = (text) => {
    setStartSearchText(text);
    if (text.length < 2) { setStartSearchResults([]); return; }
    setStartSearchResults(
      MAURITIUS_PLACES.filter(p => p.name.toLowerCase().includes(text.toLowerCase())).slice(0, 5)
    );
  };

  const selectCustomStart = async (place) => {
    Keyboard.dismiss();
    setCustomStart(place);
    setStartSearchText(place.name);
    setStartSearchResults([]);
    setEditingStart(false);
    if (stops.length > 0) await buildRoutes(stops, place);
  };

  const resetToGPSStart = async () => {
    setCustomStart(null);
    setStartSearchText('');
    setEditingStart(false);
    if (stops.length > 0) await buildRoutes(stops, null);
  };

  const addStop = async (place) => {
    Keyboard.dismiss();
    setSearchText('');
    setSearchResults([]);
    const newStops = [...stops, { ...place, id: `stop-${Date.now()}` }];
    setStops(newStops);
    mapRef.current?.animateToRegion({
      latitude: place.lat, longitude: place.lng,
      latitudeDelta: 0.05, longitudeDelta: 0.05,
    }, 600);
    await buildRoutes(newStops, customStart);
  };

  const removeStop = async (index) => {
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops);
    await buildRoutes(newStops, customStart);
    if (newStops.length === 0) { setRouteHazards(null); setRouteSegments([]); }
  };

  const moveStopUp = async (index) => {
    if (index === 0) return;
    const newStops = [...stops];
    [newStops[index - 1], newStops[index]] = [newStops[index], newStops[index - 1]];
    setStops(newStops);
    await buildRoutes(newStops, customStart);
  };

  // FIX 3: buildRoutes now accepts explicit startOverride
  const buildRoutes = async (currentStops, startOverride = undefined) => {
    if (currentStops.length === 0) { setRouteSegments([]); setRouteHazards(null); return; }
    setLoadingRoute(true);

    const start = startOverride !== undefined ? startOverride : customStart;

    const waypoints = [];
    if (start) {
      waypoints.push({ lat: start.lat, lng: start.lng });
    } else if (location) {
      waypoints.push({ lat: location.latitude, lng: location.longitude });
    }
    currentStops.forEach(s => waypoints.push({ lat: s.lat, lng: s.lng }));

    if (waypoints.length < 2) { setLoadingRoute(false); return; }

    const segments = [];
    const allCoords = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const result = await fetchOSRMRoute(waypoints[i], waypoints[i + 1]);
      const fromLabel = i === 0 ? (start ? start.name : 'Your location') : (currentStops[i - 1]?.name || `Stop ${i}`);
      if (result) {
        segments.push({ ...result, from: fromLabel, to: currentStops[i]?.name || `Stop ${i + 1}` });
        allCoords.push(...result.coords);
      } else {
        const fallback = [
          { latitude: waypoints[i].lat,   longitude: waypoints[i].lng },
          { latitude: waypoints[i+1].lat, longitude: waypoints[i+1].lng },
        ];
        segments.push({ coords: fallback, distance: '?', duration: '?', steps: [], from: fromLabel, to: `Stop ${i+1}` });
        allCoords.push(...fallback);
      }
    }

    setRouteSegments(segments);

    if (allCoords.length > 1) {
      setRouteHazards(allHazards.filter(h => isNearRoute(h, allCoords)));
      mapRef.current?.fitToCoordinates(allCoords, {
        edgePadding: { top: 130, right: 50, bottom: 320, left: 50 },
        animated: true,
      });
    }

    setLoadingRoute(false);
  };

  const clearRoute = () => {
    setStops([]); setRouteSegments([]); setRouteHazards(null);
    setSearchText(''); setSearchResults([]);
    setCustomStart(null); setStartSearchText(''); setStartSearchResults([]);
    setEditingStart(false);
  };

  const totalDistance = routeSegments.reduce((sum, s) => sum + (parseFloat(s.distance) || 0), 0).toFixed(1);
  const totalDuration  = routeSegments.reduce((sum, s) => sum + (parseInt(s.duration) || 0), 0);

  const routeWarnings = ACCIDENT_BLACK_SPOTS.filter(bs =>
    stops.some(stop => Math.abs(bs.lat - stop.lat) < 0.05 && Math.abs(bs.lng - stop.lng) < 0.05)
  );

  // FIX 2: Traffic segments that overlap the active route (shown automatically)
  const routeTrafficSegments = allRouteCoords.length > 0
    ? liveTraffic.filter(seg => segmentOverlapsRoute(seg, allRouteCoords))
    : [];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ latitude: -20.2744, longitude: 57.5512, latitudeDelta: 0.8, longitudeDelta: 0.8 }}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Hazard circles */}
        {showHazards && visibleHazards.map(h => {
          const radius = getHazardRadius(h.type, h.severity);
          if (!radius) return null;
          return (
            <Circle key={`circle-${h.id}`}
              center={{ latitude: h.latitude, longitude: h.longitude }}
              radius={radius}
              strokeColor={(SEVERITY_COLORS[h.severity] || '#aaa') + '80'}
              fillColor={(SEVERITY_COLORS[h.severity]  || '#aaa') + '25'}
            />
          );
        })}

        {/* Hazard markers */}
        {showHazards && visibleHazards.map(h => {
          if (!h.latitude || !h.longitude) return null;
          return (
            <Marker key={`marker-${h.id}`}
              coordinate={{ latitude: h.latitude, longitude: h.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.markerPin, { backgroundColor: HAZARD_COLORS[h.type] || '#7f8c8d' }, h._isReport && styles.reportBorder]}>
                <Text style={styles.markerEmoji}>{HAZARD_ICONS[h.type] || '📍'}</Text>
                {h._isReport && <View style={styles.reportBadge}><Text style={styles.reportBadgeText}>!</Text></View>}
              </View>
              <Callout style={styles.callout}>
                <Text style={styles.calloutTitle}>{HAZARD_ICONS[h.type]} {h.type?.toUpperCase()}{h._isReport ? ' (Reported)' : ''}</Text>
                {h.area && <Text style={styles.calloutSub}>📍 {h.area}</Text>}
                <Text style={[styles.calloutSev, { color: SEVERITY_COLORS[h.severity] }]}>⚡ {h.severity}</Text>
                <Text style={styles.calloutSub}>👥 {h.reports || 1} report(s)</Text>
              </Callout>
            </Marker>
          );
        })}

        {/* FIX 2: Traffic overlay — only shown when a route is active, on road geometry */}
        {routeTrafficSegments.map(seg => {
          const color = getTrafficColor(seg.avgSpeed, seg.freeFlowSpeed);
          // FIX 1: Use road-snapped coords if loaded, else fallback straight line
          const roadCoords = trafficRoadCoords[seg.id] || [
            { latitude: seg.startLat, longitude: seg.startLng },
            { latitude: seg.endLat,   longitude: seg.endLng   },
          ];
          const midLat = (seg.startLat + seg.endLat) / 2;
          const midLng = (seg.startLng + seg.endLng) / 2;
          return (
            <React.Fragment key={`traffic-${seg.id}`}>
              <Polyline
                coordinates={roadCoords}
                strokeColor={color}
                strokeWidth={8}
                zIndex={5}
              />
              <Marker coordinate={{ latitude: midLat, longitude: midLng }} anchor={{ x: 0.5, y: 0.5 }} zIndex={6}>
                <View style={[styles.trafficBadge, { backgroundColor: color }]}>
                  <Text style={styles.trafficText}>{seg.avgSpeed}km/h</Text>
                </View>
                <Callout style={styles.callout}>
                  <Text style={styles.calloutTitle}>🚦 {seg.name}</Text>
                  <Text style={styles.calloutSub}>Now: {seg.avgSpeed} km/h · Limit: {seg.freeFlowSpeed} km/h</Text>
                  <Text style={[styles.calloutSev, { color }]}>{seg.congestion.toUpperCase()}</Text>
                  <Text style={styles.calloutSub}>⚡ Live from nearby users</Text>
                </Callout>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Black spots */}
        {showBlackSpots && ACCIDENT_BLACK_SPOTS.map(spot => (
          <React.Fragment key={`bs-${spot.id}`}>
            <Circle
              center={{ latitude: spot.lat, longitude: spot.lng }}
              radius={spot.severity === 'HIGH' ? 800 : 500}
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
                <Text style={styles.calloutSub}>📊 {spot.accidents} accidents recorded</Text>
                <Text style={styles.calloutSub}>{spot.description}</Text>
              </Callout>
            </Marker>
          </React.Fragment>
        ))}

        {/* Speed zones */}
        {showSpeedZones && SPEED_ZONES.map(zone => {
          const color = zone.type === 'highway' ? '#3498DB' : zone.type === 'main' ? '#F39C12' : '#E74C3C';
          return (
            <Marker key={`sz-${zone.id}`} coordinate={{ latitude: zone.lat, longitude: zone.lng }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.speedBadge, { backgroundColor: color }]}>
                <Text style={styles.speedBadgeNum}>{zone.limit}</Text>
                <Text style={styles.speedBadgeUnit}>km/h</Text>
              </View>
              <Callout style={styles.callout}>
                <Text style={styles.calloutTitle}>⚡ {zone.name}</Text>
                <Text style={styles.calloutSub}>Speed limit: {zone.limit} km/h</Text>
                <Text style={styles.calloutSub}>Road type: {zone.type}</Text>
              </Callout>
            </Marker>
          );
        })}

        {/* FIX 3: Custom start marker */}
        {customStart && (
          <Marker coordinate={{ latitude: customStart.lat, longitude: customStart.lng }} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.startMarker}>
              <Text style={styles.startMarkerEmoji}>🟢</Text>
            </View>
            <Callout style={styles.callout}>
              <Text style={styles.calloutTitle}>🟢 Start Point</Text>
              <Text style={styles.calloutSub}>{customStart.name}</Text>
            </Callout>
          </Marker>
        )}

        {/* Stop markers */}
        {stops.map((stop, i) => (
          <Marker key={stop.id} coordinate={{ latitude: stop.lat, longitude: stop.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[styles.stopMarker, i === stops.length - 1 && { backgroundColor: '#E74C3C' }]}>
              <Text style={styles.stopMarkerText}>{i + 1}</Text>
            </View>
            <Callout style={styles.callout}>
              <Text style={styles.calloutTitle}>Stop {i + 1}{i === stops.length - 1 ? ' (Destination)' : ''}</Text>
              <Text style={styles.calloutSub}>{stop.name}</Text>
              {routeSegments[i] && <Text style={styles.calloutSub}>📏 {routeSegments[i]?.distance} km · ⏱ {routeSegments[i]?.duration} min</Text>}
            </Callout>
          </Marker>
        ))}

        {/* Route polylines */}
        {routeSegments.map((seg, i) => (
          <Polyline key={`route-${i}`} coordinates={seg.coords} strokeColor="#3498DB" strokeWidth={5} lineDashPattern={[0]} zIndex={4} />
        ))}
      </MapView>

      {/* ── TOP LAYER BAR ── FIX 2: removed Traffic toggle */}
      <View style={styles.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topBarScroll}>
          {[
            { key: 'hazards',    label: '🕳️ Hazards',    active: showHazards,      style: styles.layerOn,     onPress: () => setShowHazards(!showHazards) },
            { key: 'blackspots', label: '💀 Black Spots', active: showBlackSpots,   style: styles.layerDanger, onPress: () => setShowBlackSpots(!showBlackSpots) },
            { key: 'speed',      label: '⚡ Speed Zones', active: showSpeedZones,   style: styles.layerSpeed,  onPress: () => setShowSpeedZones(!showSpeedZones) },
            { key: 'route',      label: '🗺️ Directions',  active: showRoutePlanner, style: styles.layerRoute,  onPress: () => setShowRoutePlanner(!showRoutePlanner) },
          ].map(btn => (
            <TouchableOpacity key={btn.key} style={[styles.layerBtn, btn.active && btn.style]} onPress={btn.onPress}>
              <Text style={[styles.layerText, btn.active && styles.layerTextOn]}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── HAZARD FILTER BAR ── */}
      {showHazards && !showRoutePlanner && (
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {HAZARD_FILTERS.map(f => (
              <TouchableOpacity key={f.key}
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

      {/* FIX 2: Traffic legend — only when route is active and has traffic data */}
      {routeTrafficSegments.length > 0 && (
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Traffic</Text>
          {[['#2ECC71','Free'],['#F39C12','Moderate'],['#E67E22','Heavy'],['#E74C3C','Standstill']].map(([c, l]) => (
            <View key={l} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: c }]} />
              <Text style={styles.legendText}>{l}</Text>
            </View>
          ))}
          <Text style={styles.legendHint}>Live from users</Text>
        </View>
      )}

      {/* ── ROUTE PLANNER PANEL ── */}
      {showRoutePlanner && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.routeKAV}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.routePanel}>

              {/* Header + summary */}
              <View style={styles.routeHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeTitle}>
                    🗺️ Directions
                    {loadingRoute && <Text style={styles.routeLoading}> ⏳</Text>}
                  </Text>
                  {stops.length > 0 && !loadingRoute && (
                    <Text style={styles.routeSummary}>
                      📏 {totalDistance} km · ⏱ {totalDuration} min
                      {routeHazards !== null ? ` · ⚠️ ${routeHazards.length} hazards` : ''}
                      {routeTrafficSegments.length > 0 ? ` · 🚦 ${routeTrafficSegments.length} traffic zones` : ''}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {stops.length > 0 && (
                    <TouchableOpacity style={styles.clearBtn} onPress={clearRoute}>
                      <Text style={styles.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                  {routeSegments.length > 0 && (
                    <TouchableOpacity style={styles.fitBtn} onPress={() => {
                      const all = routeSegments.flatMap(s => s.coords);
                      if (all.length > 1) mapRef.current?.fitToCoordinates(all, { edgePadding: { top:130,right:50,bottom:320,left:50 }, animated:true });
                    }}>
                      <Text style={styles.fitBtnText}>Fit ↗</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* FIX 3: Start point picker */}
              <View style={styles.startRow}>
                <View style={[styles.stopDot, { backgroundColor: '#2ECC71', marginRight: 8 }]} />
                {editingStart ? (
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={styles.startInput}
                      placeholder="Search start location…"
                      placeholderTextColor="#7f8c8d"
                      value={startSearchText}
                      onChangeText={searchStartPlaces}
                      autoFocus
                    />
                    {startSearchResults.length > 0 && (
                      <View style={styles.searchDropdown}>
                        {startSearchResults.map((place, i) => (
                          <TouchableOpacity key={`sr-${i}`}
                            style={[styles.searchResult, i < startSearchResults.length - 1 && styles.searchResultBorder]}
                            onPress={() => selectCustomStart(place)}
                          >
                            <Text style={styles.searchResultIcon}>📍</Text>
                            <Text style={styles.searchResultText}>{place.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity onPress={() => { setEditingStart(false); setStartSearchResults([]); }}>
                      <Text style={styles.startCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => { setEditingStart(true); setStartSearchText(customStart?.name || ''); }}>
                    <Text style={styles.startPointText}>
                      {customStart ? `📍 ${customStart.name}` : '📍 Your current location'}
                    </Text>
                    <Text style={styles.startPointHint}>Tap to change start</Text>
                  </TouchableOpacity>
                )}
                {customStart && !editingStart && (
                  <TouchableOpacity onPress={resetToGPSStart} style={styles.stopBtn}>
                    <Text style={styles.stopBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Destination search input */}
              <TextInput
                style={styles.searchInput}
                placeholder="Add destination — e.g. Grand Baie, Airport…"
                placeholderTextColor="#7f8c8d"
                value={searchText}
                onChangeText={searchPlaces}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />

              {/* Dropdown results */}
              {searchResults.length > 0 && (
                <View style={styles.searchDropdown}>
                  {searchResults.map((place, i) => (
                    <TouchableOpacity key={`res-${i}`}
                      style={[styles.searchResult, i < searchResults.length - 1 && styles.searchResultBorder]}
                      onPress={() => addStop(place)}
                    >
                      <Text style={styles.searchResultIcon}>📍</Text>
                      <Text style={styles.searchResultText}>{place.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                {/* Stops with segment info */}
                {stops.map((stop, i) => (
                  <View key={stop.id}>
                    {routeSegments[i] && (
                      <View style={styles.segmentInfo}>
                        <Text style={styles.segmentText}>
                          ↓ {routeSegments[i].distance} km · {routeSegments[i].duration} min via road
                        </Text>
                      </View>
                    )}
                    <View style={styles.stopRow}>
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
                  </View>
                ))}

                {stops.length === 0 && (
                  <Text style={styles.emptyRoute}>Search a destination above to get directions</Text>
                )}

                {/* Black spot warnings near route */}
                {routeWarnings.length > 0 && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>⚠️ Black spots near your route</Text>
                    {routeWarnings.map((w, i) => (
                      <Text key={i} style={styles.warningText}>• {w.name} — {w.accidents} accidents recorded</Text>
                    ))}
                  </View>
                )}
              </ScrollView>

            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {/* ── STATS BAR ── */}
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
            <Text style={[styles.statNum, { color: '#F39C12' }]}>
              {liveTraffic.filter(t => t.congestion === 'heavy' || t.congestion === 'standstill').length}
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

  topBar: { position: 'absolute', top: 10, left: 0, right: 0 },
  topBarScroll: { paddingHorizontal: 10, gap: 6 },
  layerBtn: { backgroundColor: 'rgba(26,26,46,0.93)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2d2d4e' },
  layerOn:      { backgroundColor: '#E74C3C', borderColor: '#E74C3C' },
  layerDanger:  { backgroundColor: '#C0392B', borderColor: '#C0392B' },
  layerSpeed:   { backgroundColor: '#2980B9', borderColor: '#2980B9' },
  layerRoute:   { backgroundColor: '#8E44AD', borderColor: '#8E44AD' },
  layerText:    { color: '#bdc3c7', fontSize: 12, fontWeight: '600' },
  layerTextOn:  { color: '#fff' },

  filterBar: { position: 'absolute', top: 56, left: 0, right: 0 },
  filterScroll: { paddingHorizontal: 10, gap: 6 },
  filterBtn: { backgroundColor: 'rgba(13,13,26,0.9)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#2d2d4e' },
  filterBtnActive: { backgroundColor: '#3498DB', borderColor: '#3498DB' },
  filterText: { color: '#bdc3c7', fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  legend: { position: 'absolute', right: 10, top: 56, backgroundColor: 'rgba(13,13,26,0.93)', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#2d2d4e' },
  legendTitle: { color: '#ecf0f1', fontSize: 11, fontWeight: '700', marginBottom: 5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#bdc3c7', fontSize: 10 },
  legendHint: { color: '#7f8c8d', fontSize: 9, marginTop: 4, textAlign: 'center' },

  routeKAV: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  routePanel: { backgroundColor: 'rgba(13,13,26,0.97)', borderTopWidth: 2, borderTopColor: '#3498DB', padding: 14 },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  routeTitle: { color: '#ecf0f1', fontSize: 15, fontWeight: '700' },
  routeLoading: { color: '#F39C12' },
  routeSummary: { color: '#3498DB', fontSize: 12, marginTop: 2 },
  fitBtn: { backgroundColor: '#3498DB20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  fitBtnText: { color: '#3498DB', fontSize: 12, fontWeight: '600' },
  clearBtn: { backgroundColor: '#E74C3C20', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  clearBtnText: { color: '#E74C3C', fontSize: 12, fontWeight: '600' },

  // FIX 3: start row styles
  startRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#2d2d4e' },
  startInput: { backgroundColor: '#1a1a2e', color: '#ecf0f1', borderRadius: 8, padding: 8, fontSize: 13, borderWidth: 1, borderColor: '#2ECC71', marginBottom: 4 },
  startPointText: { color: '#ecf0f1', fontSize: 13 },
  startPointHint: { color: '#7f8c8d', fontSize: 10, marginTop: 2 },
  startCancelText: { color: '#7f8c8d', fontSize: 12, marginTop: 4 },

  searchInput: { backgroundColor: '#1a1a2e', color: '#ecf0f1', borderRadius: 10, padding: 11, fontSize: 14, borderWidth: 1, borderColor: '#2d2d4e', marginBottom: 6 },
  searchDropdown: { backgroundColor: '#1a1a2e', borderRadius: 10, borderWidth: 1, borderColor: '#2d2d4e', marginBottom: 8 },
  searchResult: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  searchResultBorder: { borderBottomWidth: 1, borderBottomColor: '#2d2d4e' },
  searchResultIcon: { fontSize: 14, marginRight: 8 },
  searchResultText: { color: '#ecf0f1', fontSize: 13 },
  segmentInfo: { paddingVertical: 3, paddingLeft: 32 },
  segmentText: { color: '#3498DB', fontSize: 11 },
  stopRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2d2d4e' },
  stopDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10, flexShrink: 0 },
  stopDotNum: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stopRowText: { color: '#ecf0f1', fontSize: 13, flex: 1 },
  stopActions: { flexDirection: 'row', gap: 6 },
  stopBtn: { backgroundColor: '#1a1a2e', width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  stopBtnText: { color: '#bdc3c7', fontSize: 14, fontWeight: '700' },
  emptyRoute: { color: '#7f8c8d', fontSize: 13, textAlign: 'center', padding: 12 },
  warningBox: { marginTop: 8, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E74C3C', backgroundColor: '#E74C3C10' },
  warningTitle: { color: '#E74C3C', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  warningText: { color: '#bdc3c7', fontSize: 12, marginBottom: 2 },

  statsBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(13,13,26,0.95)', flexDirection: 'row', padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#2d2d4e' },
  statItem: { flex: 1, alignItems: 'center' },
  statNum:  { fontSize: 20, fontWeight: 'bold', color: '#3498DB' },
  statLbl:  { fontSize: 10, color: '#7f8c8d', marginTop: 2 },
  refreshBtn: { padding: 8 },
  refreshText: { fontSize: 20 },

  markerPin: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  reportBorder: { borderColor: '#FFD700', borderWidth: 3 },
  reportBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FFD700', borderRadius: 8, width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  reportBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#000' },
  markerEmoji: { fontSize: 16 },
  trafficBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: '#fff' },
  trafficText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  speedBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  speedBadgeNum: { color: '#fff', fontSize: 11, fontWeight: '700' },
  speedBadgeUnit: { color: '#ffffffaa', fontSize: 7 },
  stopMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#3498DB', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  stopMarkerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  startMarker: { alignItems: 'center' },
  startMarkerEmoji: { fontSize: 24 },
  callout: { width: 210, padding: 8 },
  calloutTitle: { fontSize: 13, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  calloutSub: { fontSize: 12, color: '#555', marginBottom: 2 },
  calloutSev: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
});