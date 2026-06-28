import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import NewMemberFace from './pages/NewMemberFace';
import FaceAttendance from './pages/FaceAttendance';
import { isFirebaseConfigured } from './firebase/config';
import './index.css';

function FirebaseWarningBanner() {
  if (isFirebaseConfigured) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: 'rgba(245, 158, 11, 0.95)',
      color: '#000',
      padding: '0.6rem 1rem',
      fontSize: '0.78rem',
      fontWeight: 600,
      textAlign: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      ⚠️ Firebase not configured — fill in your API key in the <code>.env</code> file
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <FirebaseWarningBanner />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<NewMemberFace />} />
        <Route path="/attendance" element={<FaceAttendance />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
