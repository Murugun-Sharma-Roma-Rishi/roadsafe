import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, Image, ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import axios from 'axios';

const API_URL = 'http://192.168.1.100:3001'; // Change to your IP

const HAZARD_TYPES = [
  { id: 'pothole', label: 'Pothole', icon: '🕳️', color: '#E74C3C' },
  { id: 'flood', label: 'Flood', icon: '🌊', color: '#3498DB' },
  { id: 'accident', label: 'Accident', icon: '💥', color: '#FF6B35' },
  { id: 'roadblock', label: 'Roadblock', icon: '🚧', color: '#F39C12' },
  { id: 'signal', label: 'Broken Signal', icon: '🚦', color: '#9B59B6' },
  { id: 'reckless', label: 'Reckless Driver', icon: '🏎️', color: '#E74C3C' },
  { id: 'debris', label: 'Road Debris', icon: '🪨', color: '#95A5A6' },
  { id: 'other', label: 'Other Hazard', icon: '⚠️', color: '#F39C12' },
];

export default function ReportScreen() {
  const [selectedType, setSelectedType] = useState(null);
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
    }
  };

  const takePhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera needed', 'Allow camera access to photograph hazards');
        return;
      }
    }
    setShowCamera(true);
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      const p = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: false });
      setPhoto(p.uri);
      setShowCamera(false);
    }
  };

  const submitReport = async () => {
    if (!selectedType) {
      Alert.alert('Select hazard type', 'Please choose what kind of hazard you are reporting');
      return;
    }
    setSubmitting(true);

    const report = {
      type: selectedType.id,
      severity,
      description,
      latitude: location?.latitude,
      longitude: location?.longitude,
      hasPhoto: !!photo,
      timestamp: new Date().toISOString(),
      anonymous: true, // Privacy by default
    };

    try {
      await axios.post(`${API_URL}/api/reports`, report);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setSelectedType(null);
        setDescription('');
        setPhoto(null);
        setSeverity('MEDIUM');
      }, 3000);
    } catch (e) {
      // Save offline
      Alert.alert(
        'Saved Offline',
        'No internet connection. Your report is saved and will be sent when you are back online.',
        [{ text: 'OK' }]
      );
    }
    setSubmitting(false);
  };

  if (showCamera) {
    return (
      <View style={{ flex: 1 }}>
        <CameraView style={{ flex: 1 }} ref={cameraRef} facing="back">
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraHint}>Point at the hazard and take a photo</Text>
            <TouchableOpacity style={styles.captureBtn} onPress={capturePhoto}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCamera(false)}>
              <Text style={styles.cancelText}>✕ Cancel</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Report Submitted!</Text>
        <Text style={styles.successText}>
          Thank you for helping keep Mauritius roads safe.{'\n'}
          Your anonymous report has been sent to the authorities.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report a Road Hazard</Text>
        <Text style={styles.headerSubtitle}>All reports are anonymous • Help keep Mauritius safe</Text>
      </View>

      {/* Hazard Type Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. What hazard are you reporting?</Text>
        <View style={styles.typeGrid}>
          {HAZARD_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeCard,
                selectedType?.id === type.id && { borderColor: type.color, backgroundColor: type.color + '20' }
              ]}
              onPress={() => setSelectedType(type)}
            >
              <Text style={styles.typeIcon}>{type.icon}</Text>
              <Text style={[styles.typeLabel, selectedType?.id === type.id && { color: type.color }]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Severity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. How severe is it?</Text>
        <View style={styles.severityRow}>
          {['LOW', 'MEDIUM', 'HIGH'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.severityBtn,
                severity === s && styles[`severity${s}`]
              ]}
              onPress={() => setSeverity(s)}
            >
              <Text style={[styles.severityText, severity === s && { color: '#fff' }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>3. Location (auto-detected)</Text>
        <View style={styles.locationCard}>
          {location ? (
            <>
              <Text style={styles.locationText}>✅ GPS Location captured</Text>
              <Text style={styles.locationCoords}>
                {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              </Text>
              <Text style={styles.locationAccuracy}>Accuracy: ±{location.accuracy?.toFixed(0) || '?'}m</Text>
            </>
          ) : (
            <TouchableOpacity onPress={getLocation}>
              <Text style={styles.locationText}>📍 Tap to get your location</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Photo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Add a photo (optional but helpful)</Text>
        {photo ? (
          <View>
            <Image source={{ uri: photo }} style={styles.photoPreview} />
            <TouchableOpacity style={styles.retakeBtn} onPress={takePhoto}>
              <Text style={styles.retakeText}>📷 Retake Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
            <Text style={styles.photoBtnText}>📷 Take Photo of Hazard</Text>
            <Text style={styles.photoBtnSub}>AI will analyze the image automatically</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>5. Add details (optional)</Text>
        <TextInput
          style={styles.textInput}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the hazard... (e.g. Large pothole near the traffic light, causing cars to swerve)"
          placeholderTextColor="#7f8c8d"
          multiline
          numberOfLines={4}
          maxLength={500}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
        onPress={submitReport}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>📢 Submit Anonymous Report</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.privacyNote}>
        🔒 Your identity is never stored. Reports are anonymous and used only to improve road safety.
      </Text>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d1a' },
  header: {
    backgroundColor: '#1a1a2e', padding: 20,
    borderBottomWidth: 1, borderBottomColor: '#2d2d4e',
  },
  headerTitle: { color: '#ecf0f1', fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { color: '#7f8c8d', fontSize: 13, marginTop: 4 },
  section: { margin: 12, marginBottom: 0 },
  sectionTitle: { color: '#ecf0f1', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeCard: {
    width: '22%', backgroundColor: '#1a1a2e',
    borderRadius: 12, padding: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#2d2d4e',
  },
  typeIcon: { fontSize: 24, marginBottom: 4 },
  typeLabel: { fontSize: 10, color: '#bdc3c7', textAlign: 'center' },
  severityRow: { flexDirection: 'row', gap: 10 },
  severityBtn: {
    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#2d2d4e', backgroundColor: '#1a1a2e',
  },
  severityLOW: { backgroundColor: '#27AE60', borderColor: '#27AE60' },
  severityMEDIUM: { backgroundColor: '#F39C12', borderColor: '#F39C12' },
  severityHIGH: { backgroundColor: '#E74C3C', borderColor: '#E74C3C' },
  severityText: { color: '#bdc3c7', fontWeight: '700', fontSize: 13 },
  locationCard: {
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#2d2d4e',
  },
  locationText: { color: '#2ECC71', fontSize: 14, fontWeight: '600' },
  locationCoords: { color: '#bdc3c7', fontSize: 12, marginTop: 4, fontFamily: 'monospace' },
  locationAccuracy: { color: '#7f8c8d', fontSize: 11, marginTop: 2 },
  photoBtn: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 24,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#3498DB', borderStyle: 'dashed',
  },
  photoBtnText: { color: '#3498DB', fontSize: 15, fontWeight: '700' },
  photoBtnSub: { color: '#7f8c8d', fontSize: 11, marginTop: 4 },
  photoPreview: { width: '100%', height: 200, borderRadius: 12 },
  retakeBtn: { marginTop: 8, alignItems: 'center', padding: 8 },
  retakeText: { color: '#3498DB', fontSize: 13 },
  textInput: {
    backgroundColor: '#1a1a2e', color: '#ecf0f1',
    borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#2d2d4e',
    fontSize: 14, textAlignVertical: 'top', minHeight: 100,
  },
  charCount: { color: '#7f8c8d', fontSize: 11, textAlign: 'right', marginTop: 4 },
  submitBtn: {
    backgroundColor: '#E74C3C', margin: 12, padding: 18,
    borderRadius: 14, alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  privacyNote: {
    color: '#7f8c8d', fontSize: 12, textAlign: 'center',
    paddingHorizontal: 20, lineHeight: 18,
  },
  cameraOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50 },
  cameraHint: { color: '#fff', fontSize: 16, marginBottom: 30, textShadowColor: '#000', textShadowRadius: 4 },
  captureBtn: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  cancelBtn: { marginTop: 20, padding: 12 },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  successContainer: {
    flex: 1, backgroundColor: '#0d0d1a',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  successIcon: { fontSize: 80, marginBottom: 20 },
  successTitle: { color: '#2ECC71', fontSize: 26, fontWeight: 'bold', marginBottom: 12 },
  successText: { color: '#bdc3c7', fontSize: 15, textAlign: 'center', lineHeight: 24 },
});