import React, { useState, useMemo } from 'react';
import './MemberSearch.css';

/**
 * Member search and selection component.
 *
 * @param {object} props
 * @param {Array} props.members - Array of member objects
 * @param {boolean} props.loading - Loading state
 * @param {function} props.onSelect - Callback when member is selected
 */
export default function MemberSearch({ members, loading, onSelect }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return members.slice(0, 20);
    const q = query.toLowerCase();
    return members.filter(
      (m) =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.member_code && m.member_code.toLowerCase().includes(q)) ||
        (m.staff_code && m.staff_code.toLowerCase().includes(q)) ||
        (m.biometric_id && String(m.biometric_id).includes(q)) ||
        (m.mobile && String(m.mobile).includes(q))
    );
  }, [query, members]);

  return (
    <div className="member-search">
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          id="member-search-input"
          className="search-input"
          type="text"
          placeholder="Search by name, code, or mobile..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {query && (
          <button className="search-clear" onClick={() => setQuery('')}>
            ✕
          </button>
        )}
      </div>

      {loading ? (
        <div className="search-loading">Loading members...</div>
      ) : (
        <div className="member-list">
          {filtered.length === 0 ? (
            <div className="search-empty">No members found</div>
          ) : (
            filtered.map((member) => (
              <button
                key={member.id}
                id={`member-item-${member.id}`}
                className="member-list-item"
                onClick={() => onSelect(member)}
              >
                <div className="member-item-avatar">
                  {(member.name || '?')[0].toUpperCase()}
                </div>
                <div className="member-item-info">
                  <div className="member-item-name">{member.name || 'Unknown'}</div>
                  <div className="member-item-meta">
                    <span>#{member.member_code || member.staff_code || 'N/A'}</span>
                    {member.biometric_id && <span> · Bio: {member.biometric_id}</span>}
                    {member.faceRegistered && (
                      <span className="face-registered-badge"> · ✓ Face Registered</span>
                    )}
                  </div>
                </div>
                <span className={`member-status-dot ${member.status && member.status.toLowerCase() === 'active' ? 'dot-active' : 'dot-inactive'}`} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
