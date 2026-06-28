import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();

  const handleStartAttendance = () => {
    // Android WebView Autoplay Unlock
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance('');
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctx.resume();
      }
    } catch (e) {}
    
    navigate('/attendance');
  };

  return (
    <div className="home-page">
      {/* Background decoration */}
      <div className="home-bg-orb home-bg-orb-1" />
      <div className="home-bg-orb home-bg-orb-2" />

      <div className="home-content">
        {/* Header */}
        <header className="home-header">
          <div className="home-logo">
            <span className="logo-icon">💪</span>
          </div>
          <h1 className="home-gym-name">GYM ERP</h1>
          <p className="home-subtitle">Face Attendance Kiosk</p>
          <div className="home-status-bar">
            <span className="status-dot-live" />
            <span className="status-live-text">Kiosk Active</span>
          </div>
        </header>

        {/* Main action card */}
        <main className="home-main">
          <div className="action-card">
            <div className="action-card-icon">🤖</div>
            <h2 className="action-card-title">Face Attendance</h2>
            <p className="action-card-desc">
              AI-powered face recognition for instant gym check-ins. No cards, no codes — just your face.
            </p>

            <div className="action-buttons">
              <button
                id="btn-start-attendance"
                className="action-btn action-btn-primary"
                onClick={handleStartAttendance}
              >
                <span className="btn-icon">📷</span>
                <span className="btn-text">
                  <span className="btn-title">Start Face Attendance</span>
                  <span className="btn-hint">Scan & mark check-in</span>
                </span>
                <span className="btn-arrow">→</span>
              </button>

              <button
                id="btn-new-member-face"
                className="action-btn action-btn-secondary"
                onClick={() => navigate('/register')}
              >
                <span className="btn-icon">➕</span>
                <span className="btn-text">
                  <span className="btn-title">New Member Face Add</span>
                  <span className="btn-hint">Register face for a member</span>
                </span>
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="home-footer">
          <p className="footer-text">🔒 Face data is processed locally. Only encrypted descriptors are stored.</p>
        </footer>
      </div>
    </div>
  );
}
