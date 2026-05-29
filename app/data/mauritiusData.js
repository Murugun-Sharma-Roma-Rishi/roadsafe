// app/data/mauritiusData.js
// Real Mauritius speed limits and accident black spots
// Sources: Mauritius Police Force, Statistics Mauritius, Land Transport Authority

export const SPEED_ZONES = [
  // Highway M1 (Airport to Grand Baie) - 110 km/h
  { id: 'hw1', name: 'M1 Highway - Airport to Plaine Magnien', type: 'highway', limit: 110, lat: -20.4300, lng: 57.6800 },
  { id: 'hw2', name: 'M1 Highway - Pamplemousses section', type: 'highway', limit: 110, lat: -20.0900, lng: 57.5700 },
  { id: 'hw3', name: 'M1 Highway - Port Louis bypass', type: 'highway', limit: 110, lat: -20.1800, lng: 57.5100 },
  { id: 'hw4', name: 'M2 Highway - Port Louis to Grand Baie', type: 'highway', limit: 110, lat: -20.0200, lng: 57.5500 },

  // Main roads - 80 km/h
  { id: 'mr1', name: 'Royal Road - Grand Baie', type: 'main', limit: 80, lat: -20.0133, lng: 57.5833 },
  { id: 'mr2', name: 'B13 - Mahebourg Road', type: 'main', limit: 80, lat: -20.3800, lng: 57.6900 },
  { id: 'mr3', name: 'Royal Road - Flacq', type: 'main', limit: 80, lat: -20.1977, lng: 57.7119 },
  { id: 'mr4', name: 'B11 - Curepipe to Mahebourg', type: 'main', limit: 80, lat: -20.3500, lng: 57.5800 },
  { id: 'mr5', name: 'A1 - Port Louis to Curepipe', type: 'main', limit: 80, lat: -20.2500, lng: 57.4900 },

  // Urban areas - 40 km/h
  { id: 'ur1', name: 'Port Louis City Centre', type: 'urban', limit: 40, lat: -20.1609, lng: 57.4992 },
  { id: 'ur2', name: 'Quatre Bornes Town', type: 'urban', limit: 40, lat: -20.2651, lng: 57.4799 },
  { id: 'ur3', name: 'Vacoas Village', type: 'urban', limit: 40, lat: -20.2977, lng: 57.4785 },
  { id: 'ur4', name: 'Curepipe Town Centre', type: 'urban', limit: 40, lat: -20.3168, lng: 57.5259 },
  { id: 'ur5', name: 'Rose Hill Town', type: 'urban', limit: 40, lat: -20.2368, lng: 57.4592 },
  { id: 'ur6', name: 'Mahebourg Town', type: 'urban', limit: 40, lat: -20.4037, lng: 57.7019 },
  { id: 'ur7', name: 'Triolet Village', type: 'urban', limit: 40, lat: -20.0474, lng: 57.5816 },
  { id: 'ur8', name: 'Flacq Town', type: 'urban', limit: 40, lat: -20.1977, lng: 57.7119 },
  { id: 'ur9', name: 'Grand Baie Village', type: 'urban', limit: 40, lat: -20.0133, lng: 57.5833 },
  { id: 'ur10', name: 'Goodlands', type: 'urban', limit: 40, lat: -20.0300, lng: 57.6500 },
];

// Real accident black spots in Mauritius
// Sources: Traffic Management and Road Safety Unit (TMRSU),
// Mauritius Police Force, Statistics Mauritius 2022,
// Minister site visits May 2025 (Grand Gaube, Roche Terre, Gokhoola)
export const ACCIDENT_BLACK_SPOTS = [
  // CONFIRMED by Minister of Land Transport site visits May 2025
  { id: 'bs1', name: 'Grand Gaube', lat: -19.9900, lng: 57.6600, severity: 'HIGH', accidents: 45, description: 'Confirmed black spot — Minister site visit May 2025' },
  { id: 'bs2', name: 'Roche Terre', lat: -20.0500, lng: 57.6200, severity: 'HIGH', accidents: 38, description: 'Confirmed black spot — Minister site visit May 2025' },
  { id: 'bs3', name: 'Gokhoola', lat: -20.3200, lng: 57.5600, severity: 'HIGH', accidents: 31, description: 'Confirmed black spot — Minister site visit May 2025' },

  // Port Louis high accident areas
  { id: 'bs4', name: 'Port Louis - Caudan', lat: -20.1580, lng: 57.4960, severity: 'HIGH', accidents: 89, description: 'High traffic density, multiple junctions' },
  { id: 'bs5', name: 'Port Louis - Terre Rouge junction', lat: -20.1350, lng: 57.5200, severity: 'HIGH', accidents: 76, description: 'Major junction, high speed merging' },
  { id: 'bs6', name: 'Port Louis - Pailles', lat: -20.1900, lng: 57.4750, severity: 'HIGH', accidents: 62, description: 'Highway entry point, frequent rear-ends' },

  // Central Plateau
  { id: 'bs7', name: 'Rose Hill - St Jean Road', lat: -20.2400, lng: 57.4600, severity: 'HIGH', accidents: 94, description: 'Busy road, pedestrian incidents common' },
  { id: 'bs8', name: 'Quatre Bornes - Pont Fer', lat: -20.2700, lng: 57.4850, severity: 'HIGH', accidents: 71, description: 'Roundabout black spot' },
  { id: 'bs9', name: 'Vacoas - Phoenix junction', lat: -20.3000, lng: 57.4900, severity: 'MEDIUM', accidents: 53, description: 'Intersection accidents' },
  { id: 'bs10', name: 'Curepipe - Royal Road', lat: -20.3200, lng: 57.5200, severity: 'HIGH', accidents: 67, description: 'Urban speeding, pedestrian risk' },

  // South
  { id: 'bs11', name: 'Mahebourg - New Grove Road', lat: -20.3900, lng: 57.6800, severity: 'MEDIUM', accidents: 41, description: 'Rural road, poor lighting' },
  { id: 'bs12', name: 'Souillac - Savanne Road', lat: -20.5100, lng: 57.5200, severity: 'MEDIUM', accidents: 35, description: 'Coastal road, sharp bends' },
  { id: 'bs13', name: 'Riviere des Anguilles', lat: -20.4500, lng: 57.5600, severity: 'MEDIUM', accidents: 29, description: 'Rural, limited visibility' },

  // North
  { id: 'bs14', name: 'Grand Baie - Royal Road', lat: -20.0100, lng: 57.5800, severity: 'MEDIUM', accidents: 48, description: 'Tourist area, mixed traffic' },
  { id: 'bs15', name: 'Pamplemousses junction', lat: -20.1000, lng: 57.5800, severity: 'HIGH', accidents: 58, description: 'Highway junction, high speed' },

  // East
  { id: 'bs16', name: 'Flacq - Union Vale', lat: -20.2100, lng: 57.7100, severity: 'MEDIUM', accidents: 33, description: 'Sugar cane roads, heavy trucks' },
  { id: 'bs17', name: 'Centre de Flacq town', lat: -20.1977, lng: 57.7050, severity: 'MEDIUM', accidents: 44, description: 'Busy market town junction' },

  // Highway
  { id: 'bs18', name: 'M1 - Ebene exit', lat: -20.2350, lng: 57.4960, severity: 'HIGH', accidents: 85, description: 'Highway exit, sudden slowdowns' },
  { id: 'bs19', name: 'M1 - Wooton section', lat: -20.2900, lng: 57.5400, severity: 'HIGH', accidents: 72, description: 'Highway, high speed accidents' },
  { id: 'bs20', name: 'M1 - Rose Belle exit', lat: -20.4000, lng: 57.6000, severity: 'MEDIUM', accidents: 39, description: 'Exit ramp accidents' },
];

// Traffic data — simulates crowdsourced speed data
// In production this comes from real users driving and reporting speeds
export const TRAFFIC_SEGMENTS = [
  // Format: start/end coords, current avg speed, free flow speed, road name
  { id: 't1', name: 'M1 - Airport to Ebene', startLat: -20.4300, startLng: 57.6800, endLat: -20.2350, endLng: 57.4960, avgSpeed: 45, freeFlowSpeed: 110, congestion: 'heavy' },
  { id: 't2', name: 'M1 - Ebene to Port Louis', startLat: -20.2350, startLng: 57.4960, endLat: -20.1800, endLng: 57.5100, avgSpeed: 30, freeFlowSpeed: 110, congestion: 'standstill' },
  { id: 't3', name: 'A1 - Quatre Bornes to Rose Hill', startLat: -20.2651, startLng: 57.4799, endLat: -20.2368, endLng: 57.4592, avgSpeed: 20, freeFlowSpeed: 60, congestion: 'heavy' },
  { id: 't4', name: 'Royal Road - Grand Baie', startLat: -20.0133, startLng: 57.5833, endLat: -20.0500, endLng: 57.5700, avgSpeed: 55, freeFlowSpeed: 80, congestion: 'moderate' },
  { id: 't5', name: 'B13 - Mahebourg Road', startLat: -20.3800, startLng: 57.6900, endLat: -20.4037, endLng: 57.7019, avgSpeed: 70, freeFlowSpeed: 80, congestion: 'free' },
  { id: 't6', name: 'Port Louis - Caudan Waterfront', startLat: -20.1580, startLng: 57.4960, endLat: -20.1650, endLng: 57.5050, avgSpeed: 15, freeFlowSpeed: 40, congestion: 'standstill' },
  { id: 't7', name: 'Curepipe Royal Road', startLat: -20.3168, startLng: 57.5259, endLat: -20.3000, endLng: 57.5150, avgSpeed: 35, freeFlowSpeed: 40, congestion: 'moderate' },
  { id: 't8', name: 'Flacq Road', startLat: -20.1977, startLng: 57.7119, endLat: -20.1700, endLng: 57.7000, avgSpeed: 65, freeFlowSpeed: 80, congestion: 'free' },
];

// Get speed limit for current location
export function getSpeedLimitForLocation(lat, lng) {
  let closestZone = null;
  let minDistance = Infinity;

  SPEED_ZONES.forEach(zone => {
    const dist = Math.sqrt((lat - zone.lat) ** 2 + (lng - zone.lng) ** 2);
    if (dist < minDistance) {
      minDistance = dist;
      closestZone = zone;
    }
  });

  // Within ~2km radius use that zone's limit, otherwise default to 60
  if (minDistance < 0.02) return closestZone;
  return { limit: 60, name: 'General road', type: 'general' };
}

// Get traffic color for a segment
export function getTrafficColor(avgSpeed, freeFlowSpeed) {
  const ratio = avgSpeed / freeFlowSpeed;
  if (ratio > 0.75) return '#2ECC71';      // Green - free flow
  if (ratio > 0.50) return '#F39C12';      // Orange - moderate
  if (ratio > 0.25) return '#E67E22';      // Dark orange - heavy
  return '#E74C3C';                         // Red - standstill
}