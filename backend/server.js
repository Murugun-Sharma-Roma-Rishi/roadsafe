const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// ========================================
// Simple file-based "database" (no setup needed!)
// In production: replace with MongoDB or PostgreSQL
// ========================================
const DB_FILE = path.join(__dirname, 'data.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {}
  return { hazards: [], reports: [], sos: [], drivers: [] };
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ========================================
// ROUTES
// ========================================

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'RoadSafe Mauritius API running!', time: new Date() });
});

// -------- HAZARDS (auto-detected by sensors) --------

// GET all hazards
app.get('/api/hazards', (req, res) => {
  const db = loadDB();
  const { type, severity, limit = 100 } = req.query;
  let hazards = db.hazards;
  if (type) hazards = hazards.filter(h => h.type === type);
  if (severity) hazards = hazards.filter(h => h.severity === severity);
  res.json(hazards.slice(-parseInt(limit)).reverse());
});

// POST new hazard (from sensor detection)
app.post('/api/hazards', (req, res) => {
  const db = loadDB();
  const hazard = {
    id: uuidv4(),
    ...req.body,
    reportCount: 1,
    createdAt: new Date().toISOString(),
    // Never store user identity
    userId: undefined,
    deviceId: undefined,
  };
  db.hazards.push(hazard);
  saveDB(db);
  console.log(`[HAZARD] ${hazard.type} @ ${hazard.latitude}, ${hazard.longitude} severity:${hazard.severity}`);
  res.status(201).json({ success: true, id: hazard.id });
});

// -------- MANUAL REPORTS --------

// GET all manual reports
app.get('/api/reports', (req, res) => {
  const db = loadDB();
  res.json(db.reports.slice(-100).reverse());
});

// POST manual report
app.post('/api/reports', (req, res) => {
  const db = loadDB();
  const report = {
    id: uuidv4(),
    ...req.body,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.reports.push(report);
  saveDB(db);
  console.log(`[REPORT] ${report.type} @ ${report.latitude}, ${report.longitude}`);
  res.status(201).json({ success: true, id: report.id });
});

// -------- SOS EMERGENCY --------

app.post('/api/sos', (req, res) => {
  const db = loadDB();
  const sos = {
    id: uuidv4(),
    ...req.body,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  db.sos.push(sos);
  saveDB(db);
  console.log(`[SOS 🆘] EMERGENCY at ${sos.latitude}, ${sos.longitude} trigger:${sos.trigger}`);
  console.log(`Google Maps: https://maps.google.com/?q=${sos.latitude},${sos.longitude}`);
  res.status(201).json({ success: true, id: sos.id });
});

// -------- DASHBOARD STATS --------

app.get('/api/stats', (req, res) => {
  const db = loadDB();
  const hazards = db.hazards;
  const reports = db.reports;

  // Count by type
  const hazardTypes = {};
  hazards.forEach(h => {
    hazardTypes[h.type] = (hazardTypes[h.type] || 0) + 1;
  });

  // Count by severity
  const bySeverity = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  hazards.forEach(h => { if (bySeverity[h.severity] !== undefined) bySeverity[h.severity]++; });

  // Top dangerous locations (cluster by area)
  const hotspots = hazards
    .filter(h => h.severity === 'HIGH')
    .slice(-20)
    .map(h => ({ lat: h.latitude, lng: h.longitude, type: h.type }));

  // Recent 7 days activity
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentHazards = hazards.filter(h => new Date(h.createdAt) > sevenDaysAgo);

  res.json({
    total: {
      hazards: hazards.length,
      reports: reports.length,
      sos: db.sos.length,
      highSeverity: bySeverity.HIGH,
    },
    hazardTypes,
    bySeverity,
    hotspots,
    recentActivity: recentHazards.length,
    lastUpdated: new Date().toISOString(),
  });
});

// -------- ROAD SAFETY SCORE BY AREA --------

app.get('/api/safety-score', (req, res) => {
  const db = loadDB();

  // Calculate scores for major Mauritius areas
  const areas = [
    { name: 'Port Louis', lat: -20.1609, lng: 57.4992 },
    { name: 'Quatre Bornes', lat: -20.2651, lng: 57.4799 },
    { name: 'Vacoas', lat: -20.2977, lng: 57.4785 },
    { name: 'Curepipe', lat: -20.3168, lng: 57.5259 },
    { name: 'Rose Hill', lat: -20.2368, lng: 57.4592 },
    { name: 'Mahebourg', lat: -20.4037, lng: 57.7019 },
    { name: 'Grand Baie', lat: -20.0133, lng: 57.5833 },
    { name: 'Flacq', lat: -20.1977, lng: 57.7119 },
  ];

  const scores = areas.map(area => {
    // Find hazards near this area (within ~10km)
    const nearby = db.hazards.filter(h => {
      const dist = Math.sqrt(
        (h.latitude - area.lat) ** 2 + (h.longitude - area.lng) ** 2
      );
      return dist < 0.1;
    });
    const highCount = nearby.filter(h => h.severity === 'HIGH').length;
    const medCount = nearby.filter(h => h.severity === 'MEDIUM').length;
    const score = Math.max(0, 100 - highCount * 10 - medCount * 5);
    return { ...area, score, hazardCount: nearby.length };
  });

  res.json(scores);
});

// -------- SAFER ROUTE SUGGESTION --------

app.post('/api/safer-route', (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.body;
  const db = loadDB();

  // Simple implementation: return hazards along the path
  // In production: use Google Maps Directions API + hazard overlay
  const pathHazards = db.hazards.filter(h => h.severity === 'HIGH').slice(-5);

  res.json({
    recommendation: 'Avoid areas with HIGH severity hazards',
    hazardsOnRoute: pathHazards.length,
    alternativeAvailable: pathHazards.length > 2,
    avoidAreas: pathHazards.map(h => ({
      lat: h.latitude,
      lng: h.longitude,
      reason: h.type,
    })),
  });
});

// -------- ADMIN: Update report status --------

app.patch('/api/reports/:id', (req, res) => {
  const db = loadDB();
  const idx = db.reports.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.reports[idx] = { ...db.reports[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveDB(db);
  res.json(db.reports[idx]);
});

// ========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🛡️  RoadSafe Mauritius API`);
  console.log(`✅  Running at http://0.0.0.0:${PORT}`);
  console.log(`📡  Endpoints:`);
  console.log(`    GET  /api/hazards`);
  console.log(`    POST /api/hazards`);
  console.log(`    GET  /api/reports`);
  console.log(`    POST /api/reports`);
  console.log(`    POST /api/sos`);
  console.log(`    GET  /api/stats`);
  console.log(`    GET  /api/safety-score`);
  console.log(`\n🔗  Dashboard: open dashboard/index.html in browser`);
});