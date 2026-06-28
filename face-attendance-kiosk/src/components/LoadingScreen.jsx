import React from 'react';
import './LoadingScreen.css';

/**
 * Reusable full-screen loading / error state component.
 */
export default function LoadingScreen({ message, error, icon }) {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        {error ? (
          <>
            <div className="loading-icon error-icon">⚠️</div>
            <h2 className="loading-title error-title">Something went wrong</h2>
            <p className="loading-message error-message">{error}</p>
          </>
        ) : (
          <>
            <div className="loading-icon">{icon || '🔍'}</div>
            <div className="loading-spinner">
              <div className="spinner-ring" />
            </div>
            <p className="loading-message">{message || 'Loading...'}</p>
          </>
        )}
      </div>
    </div>
  );
}
