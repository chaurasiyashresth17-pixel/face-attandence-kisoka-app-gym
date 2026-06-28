import React from 'react';
import './StatusOverlay.css';

/**
 * Bottom glassmorphism overlay showing member info and status message.
 *
 * @param {object} props
 * @param {object|null} props.member - Matched member data
 * @param {string} props.status - e.g. 'checking', 'checked_in', 'already_in', 'no_match', 'multi_face', 'idle'
 * @param {string} props.statusMessage - Display message
 */
export default function StatusOverlay({ member, status, statusMessage }) {
  const statusClass = {
    checking: 'status-checking',
    checked_in: 'status-success',
    already_in: 'status-warning',
    no_match: 'status-error',
    multi_face: 'status-warning',
    idle: 'status-idle',
    registered: 'status-success',
  }[status] || 'status-idle';

  const statusIcons = {
    checking: '🔍',
    checked_in: '✅',
    already_in: '⏱️',
    no_match: '❌',
    multi_face: '👥',
    idle: '📷',
    registered: '✅',
  };

  return (
    <div className={`status-overlay ${statusClass}`}>
      {statusMessage && (
        <div className="status-message">
          <span className="status-icon">{statusIcons[status] || '📷'}</span>
          <span className="status-text">{statusMessage}</span>
        </div>
      )}

      {member && (
        <div className="member-info">
          <div className="member-name">{member.name}</div>
          <div className="member-details">
            <span className="member-detail-item">
              <span className="detail-label">Code</span>
              <span className="detail-value">{member.member_code || '—'}</span>
            </span>
            <span className="member-detail-divider">|</span>
            <span className="member-detail-item">
              <span className="detail-label">Bio ID</span>
              <span className="detail-value">{member.biometric_id || '—'}</span>
            </span>
            {member.status && (
              <>
                <span className="member-detail-divider">|</span>
                <span className="member-detail-item">
                  <span className={`member-status-badge ${member.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                    {member.status}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
