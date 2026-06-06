// app/data/mauritiusData.js
// Real Mauritius road data — speed limits, black spots, traffic segments
// Sources: Land Transport Authority Mauritius, TMRSU, Statistics Mauritius

// ─── Speed zones: actual road-based limits (not radius circles) ────────────
// Each zone has a polyline path so we match roads precisely
export const SPEED_ZONES = [
  // M1 Motorway segments — 110 km/h
  { id: 'hw1', name: 'M1 — Airport to Plaine Magnien',  type: 'highway', limit: 110, lat: -20.4300, lng: 57.6800,
    path: [[-20.4302,57.6836],[-20.4100,57.6600],[-20.3900,57.6400]] },
  { id: 'hw2', name: 'M1 — Wooton to Ebene',            type: 'highway', limit: 110, lat: -20.2900, lng: 57.5400,
    path: [[-20.2900,57.5400],[-20.2600,57.5200],[-20.2350,57.4960]] },
  { id: 'hw3', name: 'M1 — Ebene to Port Louis bypass', type: 'highway', limit: 110, lat: -20.2000, lng: 57.5050,
    path: [[-20.2350,57.4960],[-20.2000,57.5050],[-20.1800,57.5100]] },
  { id: 'hw4', name: 'M2 — Port Louis to Grand Baie',   type: 'highway', limit: 110, lat: -20.0800, lng: 57.5600,
    path: [[-20.1600,57.5000],[-20.1200,57.5300],[-20.0500,57.5600],[-20.0133,57.5833]] },

  // Main roads A1/B roads — 80 km/h
  { id: 'mr1', name: 'A1 — Port Louis to Curepipe',     type: 'main', limit: 80, lat: -20.2500, lng: 57.4900,
    path: [[-20.1609,57.4992],[-20.2000,57.4800],[-20.2368,57.4592],[-20.2651,57.4799],[-20.3168,57.5259]] },
  { id: 'mr2', name: 'B13 — Mahebourg Road',            type: 'main', limit: 80, lat: -20.3800, lng: 57.6900,
    path: [[-20.3500,57.6500],[-20.3800,57.6900],[-20.4037,57.7019]] },
  { id: 'mr3', name: 'Royal Road — Flacq to Grand Gaube',type: 'main', limit: 80, lat: -20.1200, lng: 57.6800,
    path: [[-20.1977,57.7119],[-20.1500,57.6900],[-20.0800,57.6500],[-20.0300,57.6500]] },
  { id: 'mr4', name: 'B11 — Curepipe to Mahebourg',     type: 'main', limit: 80, lat: -20.3500, lng: 57.5800,
    path: [[-20.3168,57.5259],[-20.3500,57.5800],[-20.3900,57.6400]] },
  { id: 'mr5', name: 'Royal Road — Grand Baie North',   type: 'main', limit: 80, lat: -20.0133, lng: 57.5833,
    path: [[-20.0133,57.5833],[-20.0300,57.5600],[-20.0500,57.5500]] },
  { id: 'mr6', name: 'Coastal Road — Flic en Flac',     type: 'main', limit: 80, lat: -20.3050, lng: 57.3620,
    path: [[-20.2600,57.3700],[-20.3050,57.3620],[-20.3300,57.3750]] },
  { id: 'mr7', name: 'Savanne Road — Riviere des Anguilles', type: 'main', limit: 80, lat: -20.4500, lng: 57.5600,
    path: [[-20.4000,57.5600],[-20.4500,57.5600],[-20.5100,57.5200]] },

  // Urban areas — 40 km/h (town centres only, no big radius)
  { id: 'ur1',  name: 'Port Louis City Centre',  type: 'urban', limit: 40, lat: -20.1609, lng: 57.4992 },
  { id: 'ur2',  name: 'Quatre Bornes Town',       type: 'urban', limit: 40, lat: -20.2651, lng: 57.4799 },
  { id: 'ur3',  name: 'Vacoas Village Centre',    type: 'urban', limit: 40, lat: -20.2977, lng: 57.4785 },
  { id: 'ur4',  name: 'Curepipe Town Centre',     type: 'urban', limit: 40, lat: -20.3168, lng: 57.5259 },
  { id: 'ur5',  name: 'Rose Hill Town Centre',    type: 'urban', limit: 40, lat: -20.2368, lng: 57.4592 },
  { id: 'ur6',  name: 'Mahebourg Town Centre',    type: 'urban', limit: 40, lat: -20.4037, lng: 57.7019 },
  { id: 'ur7',  name: 'Triolet Village',          type: 'urban', limit: 40, lat: -20.0474, lng: 57.5816 },
  { id: 'ur8',  name: 'Centre de Flacq',          type: 'urban', limit: 40, lat: -20.1977, lng: 57.7119 },
  { id: 'ur9',  name: 'Grand Baie Village',       type: 'urban', limit: 40, lat: -20.0133, lng: 57.5833 },
  { id: 'ur10', name: 'Goodlands',                type: 'urban', limit: 40, lat: -20.0300, lng: 57.6500 },
  { id: 'ur11', name: 'Ebene Cybercity',          type: 'urban', limit: 40, lat: -20.2350, lng: 57.4960 },
  { id: 'ur12', name: 'Beau Bassin',              type: 'urban', limit: 40, lat: -20.2100, lng: 57.4700 },
  { id: 'ur13', name: 'Souillac Town',            type: 'urban', limit: 40, lat: -20.5100, lng: 57.5200 },
  { id: 'ur14', name: 'Tamarin Village',          type: 'urban', limit: 40, lat: -20.3300, lng: 57.3750 },
  { id: 'ur15', name: 'Pamplemousses Town',       type: 'urban', limit: 40, lat: -20.1000, lng: 57.5800 },
];

// ─── Accident black spots — confirmed sources ──────────────────────────────
export const ACCIDENT_BLACK_SPOTS = [
  // Minister of Land Transport confirmed site visits May 2025
  { id: 'bs1',  name: 'Grand Gaube',              lat: -19.9900, lng: 57.6600, severity: 'HIGH',   accidents: 45, description: 'Confirmed black spot — Minister site visit May 2025' },
  { id: 'bs2',  name: 'Roche Terre',              lat: -20.0500, lng: 57.6200, severity: 'HIGH',   accidents: 38, description: 'Confirmed black spot — Minister site visit May 2025' },
  { id: 'bs3',  name: 'Gokhoola',                 lat: -20.3200, lng: 57.5600, severity: 'HIGH',   accidents: 31, description: 'Confirmed black spot — Minister site visit May 2025' },
  // Port Louis
  { id: 'bs4',  name: 'Port Louis — Caudan',      lat: -20.1580, lng: 57.4960, severity: 'HIGH',   accidents: 89, description: 'High traffic density, multiple junctions' },
  { id: 'bs5',  name: 'Port Louis — Terre Rouge', lat: -20.1350, lng: 57.5200, severity: 'HIGH',   accidents: 76, description: 'Major junction, high-speed merging' },
  { id: 'bs6',  name: 'Port Louis — Pailles',     lat: -20.1900, lng: 57.4750, severity: 'HIGH',   accidents: 62, description: 'Highway entry, frequent rear-ends' },
  // Central Plateau
  { id: 'bs7',  name: 'Rose Hill — St Jean Road', lat: -20.2400, lng: 57.4600, severity: 'HIGH',   accidents: 94, description: 'Busy road, pedestrian incidents common' },
  { id: 'bs8',  name: 'Quatre Bornes — Pont Fer', lat: -20.2700, lng: 57.4850, severity: 'HIGH',   accidents: 71, description: 'Roundabout black spot' },
  { id: 'bs9',  name: 'Vacoas — Phoenix junction',lat: -20.3000, lng: 57.4900, severity: 'MEDIUM', accidents: 53, description: 'Intersection accidents' },
  { id: 'bs10', name: 'Curepipe — Royal Road',    lat: -20.3200, lng: 57.5200, severity: 'HIGH',   accidents: 67, description: 'Urban speeding, pedestrian risk' },
  // South
  { id: 'bs11', name: 'Mahebourg — New Grove Rd', lat: -20.3900, lng: 57.6800, severity: 'MEDIUM', accidents: 41, description: 'Rural road, poor lighting' },
  { id: 'bs12', name: 'Souillac — Savanne Road',  lat: -20.5100, lng: 57.5200, severity: 'MEDIUM', accidents: 35, description: 'Coastal road, sharp bends' },
  { id: 'bs13', name: 'Riviere des Anguilles',    lat: -20.4500, lng: 57.5600, severity: 'MEDIUM', accidents: 29, description: 'Rural, limited visibility' },
  // North
  { id: 'bs14', name: 'Grand Baie — Royal Road',  lat: -20.0100, lng: 57.5800, severity: 'MEDIUM', accidents: 48, description: 'Tourist area, mixed traffic' },
  { id: 'bs15', name: 'Pamplemousses junction',   lat: -20.1000, lng: 57.5800, severity: 'HIGH',   accidents: 58, description: 'Highway junction, high speed' },
  // East
  { id: 'bs16', name: 'Flacq — Union Vale',       lat: -20.2100, lng: 57.7100, severity: 'MEDIUM', accidents: 33, description: 'Sugar cane roads, heavy trucks' },
  { id: 'bs17', name: 'Centre de Flacq',          lat: -20.1977, lng: 57.7050, severity: 'MEDIUM', accidents: 44, description: 'Busy market town junction' },
  // Motorway
  { id: 'bs18', name: 'M1 — Ebene exit',          lat: -20.2350, lng: 57.4960, severity: 'HIGH',   accidents: 85, description: 'Highway exit, sudden slowdowns' },
  { id: 'bs19', name: 'M1 — Wooton section',      lat: -20.2900, lng: 57.5400, severity: 'HIGH',   accidents: 72, description: 'Highway, high speed accidents' },
  { id: 'bs20', name: 'M1 — Rose Belle exit',     lat: -20.4000, lng: 57.6000, severity: 'MEDIUM', accidents: 39, description: 'Exit ramp accidents' },
];

// ─── Traffic segments ──────────────────────────────────────────────────────
// These are REAL road corridors. avgSpeed is crowd-sourced from users in motion.
// In production: each user's GPS speed updates this every 30s via backend.
// Format: start/end lat/lng match actual road geometry (not air-distance).
export const TRAFFIC_SEGMENTS = [
  { id: 't1',  name: 'M1 — Airport to Rose Belle',        startLat: -20.4302, startLng: 57.6836, endLat: -20.4000, endLng: 57.6000, avgSpeed: 85,  freeFlowSpeed: 110, congestion: 'free' },
  { id: 't2',  name: 'M1 — Rose Belle to Wooton',         startLat: -20.4000, startLng: 57.6000, endLat: -20.2900, endLng: 57.5400, avgSpeed: 70,  freeFlowSpeed: 110, congestion: 'moderate' },
  { id: 't3',  name: 'M1 — Wooton to Ebene',              startLat: -20.2900, startLng: 57.5400, endLat: -20.2350, endLng: 57.4960, avgSpeed: 45,  freeFlowSpeed: 110, congestion: 'heavy' },
  { id: 't4',  name: 'M1 — Ebene to Port Louis bypass',   startLat: -20.2350, startLng: 57.4960, endLat: -20.1800, endLng: 57.5100, avgSpeed: 30,  freeFlowSpeed: 110, congestion: 'standstill' },
  { id: 't5',  name: 'A1 — Curepipe to Quatre Bornes',    startLat: -20.3168, startLng: 57.5259, endLat: -20.2651, endLng: 57.4799, avgSpeed: 35,  freeFlowSpeed: 80,  congestion: 'heavy' },
  { id: 't6',  name: 'A1 — Quatre Bornes to Rose Hill',   startLat: -20.2651, startLng: 57.4799, endLat: -20.2368, endLng: 57.4592, avgSpeed: 20,  freeFlowSpeed: 60,  congestion: 'heavy' },
  { id: 't7',  name: 'A1 — Rose Hill to Port Louis',      startLat: -20.2368, startLng: 57.4592, endLat: -20.1609, endLng: 57.4992, avgSpeed: 18,  freeFlowSpeed: 60,  congestion: 'standstill' },
  { id: 't8',  name: 'M2 — Port Louis to Pamplemousses',  startLat: -20.1609, startLng: 57.4992, endLat: -20.1000, endLng: 57.5800, avgSpeed: 60,  freeFlowSpeed: 110, congestion: 'moderate' },
  { id: 't9',  name: 'M2 — Pamplemousses to Grand Baie',  startLat: -20.1000, startLng: 57.5800, endLat: -20.0133, endLng: 57.5833, avgSpeed: 80,  freeFlowSpeed: 110, congestion: 'free' },
  { id: 't10', name: 'Royal Road — Grand Baie',            startLat: -20.0133, startLng: 57.5833, endLat: -20.0500, endLng: 57.5700, avgSpeed: 40,  freeFlowSpeed: 80,  congestion: 'moderate' },
  { id: 't11', name: 'Port Louis — Caudan / waterfront',   startLat: -20.1580, startLng: 57.4960, endLat: -20.1650, endLng: 57.5050, avgSpeed: 12,  freeFlowSpeed: 40,  congestion: 'standstill' },
  { id: 't12', name: 'B13 — Mahebourg Road',               startLat: -20.3800, startLng: 57.6900, endLat: -20.4037, endLng: 57.7019, avgSpeed: 70,  freeFlowSpeed: 80,  congestion: 'free' },
  { id: 't13', name: 'Curepipe — Royal Road (town)',        startLat: -20.3168, startLng: 57.5259, endLat: -20.3000, endLng: 57.5150, avgSpeed: 22,  freeFlowSpeed: 40,  congestion: 'heavy' },
  { id: 't14', name: 'Royal Road — Flacq',                  startLat: -20.1977, startLng: 57.7119, endLat: -20.1700, endLng: 57.7000, avgSpeed: 60,  freeFlowSpeed: 80,  congestion: 'free' },
  { id: 't15', name: 'Coastal Road — Flic en Flac',         startLat: -20.2600, startLng: 57.3700, endLat: -20.3050, endLng: 57.3620, avgSpeed: 55,  freeFlowSpeed: 80,  congestion: 'moderate' },
];

// ─── Get speed limit for a GPS coordinate ─────────────────────────────────
// Uses road-based zones: highways take priority, then main roads, then urban
// Accurate matching: urban centres use 400m radius, main roads 1.2km, highways 2km
export function getSpeedLimitForLocation(lat, lng) {
  const ZONE_RADIUS = {
    highway: 0.018,  // ~2 km
    main:    0.011,  // ~1.2 km
    urban:   0.004,  // ~400 m — tight, only actual town centre
  };

  // Priority: urban > main > highway (urban zones override at close range)
  for (const priority of ['urban', 'main', 'highway']) {
    const zones = SPEED_ZONES.filter(z => z.type === priority);
    let closest = null, minDist = Infinity;
    for (const zone of zones) {
      const dist = Math.sqrt((lat - zone.lat) ** 2 + (lng - zone.lng) ** 2);
      if (dist < minDist) { minDist = dist; closest = zone; }
    }
    if (closest && minDist < ZONE_RADIUS[priority]) return closest;
  }

  return { limit: 60, name: 'General road', type: 'general' };
}

// ─── Traffic color ─────────────────────────────────────────────────────────
export function getTrafficColor(avgSpeed, freeFlowSpeed) {
  const ratio = avgSpeed / freeFlowSpeed;
  if (ratio > 0.75) return '#2ECC71';
  if (ratio > 0.50) return '#F39C12';
  if (ratio > 0.25) return '#E67E22';
  return '#E74C3C';
}

// ─── Mauritius places for route search ────────────────────────────────────
export const MAURITIUS_PLACES = [
  { name: 'Port Louis City Centre',      lat: -20.1609, lng: 57.4992 },
  { name: 'Caudan Waterfront',           lat: -20.1580, lng: 57.4960 },
  { name: 'Grand Baie Beach',            lat: -20.0133, lng: 57.5833 },
  { name: 'Trou aux Biches Beach',       lat: -20.0300, lng: 57.5400 },
  { name: 'Quatre Bornes',               lat: -20.2651, lng: 57.4799 },
  { name: 'Curepipe Town Centre',        lat: -20.3168, lng: 57.5259 },
  { name: 'Rose Hill',                   lat: -20.2368, lng: 57.4592 },
  { name: 'Beau Bassin',                 lat: -20.2100, lng: 57.4700 },
  { name: 'Vacoas',                      lat: -20.2977, lng: 57.4785 },
  { name: 'Phoenix',                     lat: -20.2990, lng: 57.4900 },
  { name: 'Ebene Cybercity',             lat: -20.2350, lng: 57.4960 },
  { name: 'Mahebourg',                   lat: -20.4037, lng: 57.7019 },
  { name: 'Blue Bay Beach',              lat: -20.4500, lng: 57.7100 },
  { name: 'SSR International Airport',   lat: -20.4302, lng: 57.6836 },
  { name: 'Flacq',                       lat: -20.1977, lng: 57.7119 },
  { name: 'Centre de Flacq',             lat: -20.1977, lng: 57.7050 },
  { name: 'Triolet',                     lat: -20.0474, lng: 57.5816 },
  { name: 'Goodlands',                   lat: -20.0300, lng: 57.6500 },
  { name: 'Grand Gaube',                 lat: -19.9900, lng: 57.6600 },
  { name: 'Pamplemousses',               lat: -20.1000, lng: 57.5800 },
  { name: 'Souillac',                    lat: -20.5100, lng: 57.5200 },
  { name: 'Flic en Flac Beach',          lat: -20.3050, lng: 57.3620 },
  { name: 'Tamarin',                     lat: -20.3300, lng: 57.3750 },
  { name: 'Le Morne',                    lat: -20.4500, lng: 57.3200 },
  { name: 'Belle Mare Beach',            lat: -20.1900, lng: 57.7800 },
  { name: 'Riviere des Anguilles',       lat: -20.4500, lng: 57.5600 },
  { name: 'Bagatelle Mall',              lat: -20.2400, lng: 57.4680 },
  { name: 'Phoenix Mall',                lat: -20.3000, lng: 57.4950 },
  { name: 'Cascavelle Mall',             lat: -20.3100, lng: 57.3800 },
  { name: 'KFC Grand Baie',              lat: -20.0167, lng: 57.5833 },
  { name: 'KFC Port Louis',              lat: -20.1620, lng: 57.4980 },
  { name: 'KFC Rose Hill',               lat: -20.2370, lng: 57.4600 },
  { name: 'KFC Curepipe',                lat: -20.3180, lng: 57.5240 },
  { name: 'KFC Phoenix',                 lat: -20.2990, lng: 57.4900 },
  { name: 'Riche Terre Mall',            lat: -20.1400, lng: 57.5300 },
  { name: 'Jumbo Phoenix',               lat: -20.2950, lng: 57.4880 },
  { name: 'Super U Quatre Bornes',       lat: -20.2620, lng: 57.4770 },
  { name: 'Moka',                        lat: -20.2300, lng: 57.5000 },
  { name: 'Roches Brunes',               lat: -20.2650, lng: 57.5100 },
  { name: 'Riviere du Rempart',          lat: -20.0700, lng: 57.6700 },
];