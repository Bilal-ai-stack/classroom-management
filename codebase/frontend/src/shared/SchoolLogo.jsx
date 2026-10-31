import React, { useState } from 'react';

const SIZE_MAP = {
  xs: 22,
  sm: 32,
  md: 42,
  lg: 56,
  xl: 80,
  '2xl': 110
};

export default function SchoolLogo({
  institutionName = 'Springfield Academy',
  logoUrl = '/api/institution/logo',
  size = 'md',
  className = '',
  style = {},
  showBorder = false,
  rounded = 'md'
}) {
  const [hasError, setHasError] = useState(false);
  const dimension = typeof size === 'number' ? size : (SIZE_MAP[size] || 42);

  const borderRadiusMap = {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px'
  };
  const borderRadius = borderRadiusMap[rounded] || '8px';

  const containerStyle = {
    width: `${dimension}px`,
    height: `${dimension}px`,
    minWidth: `${dimension}px`,
    minHeight: `${dimension}px`,
    borderRadius,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'var(--surface-color, #ffffff)',
    border: showBorder ? '1px solid var(--border-color, #e2e8f0)' : 'none',
    boxShadow: showBorder ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
    flexShrink: 0,
    ...style
  };

  if (hasError) {
    return (
      <div
        className={`school-logo-fallback ${className}`}
        style={containerStyle}
        title={institutionName}
        aria-label={`${institutionName} crest`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 120 120"
          width={dimension}
          height={dimension}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <linearGradient id="fallbackShield" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="fallbackGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <path d="M60 8 C88 8 106 18 106 42 C106 78 78 104 60 114 C42 104 14 78 14 42 C14 18 32 8 60 8 Z" fill="url(#fallbackShield)" stroke="#3b82f6" strokeWidth="2"/>
          <path d="M60 14 C83 14 99 22 99 44 C99 74 74 97 60 106 C46 97 21 74 21 44 C21 22 37 14 60 14 Z" fill="none" stroke="url(#fallbackGold)" strokeWidth="1.5" strokeDasharray="2 1" opacity="0.6"/>
          <path d="M60 72 C50 67 36 67 28 72 L28 50 C36 45 50 45 60 50 Z" fill="#ffffff" opacity="0.95"/>
          <path d="M60 72 C70 67 84 67 92 72 L92 50 C84 45 70 45 60 50 Z" fill="#f1f5f9" opacity="0.95"/>
          <line x1="60" y1="50" x2="60" y2="72" stroke="#cbd5e1" strokeWidth="1.5"/>
          <polygon points="60,24 86,34 60,44 34,34" fill="url(#fallbackGold)"/>
          <polygon points="60,39 78,33 78,37 60,43 42,37 42,33" fill="#b45309"/>
          <path d="M78 34 L82 45" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="82" cy="46" r="1.5" fill="#f59e0b"/>
          <polygon points="60,82 62,87 67,87 63,90 65,95 60,92 55,95 57,90 53,87 58,87" fill="url(#fallbackGold)"/>
        </svg>
      </div>
    );
  }

  return (
    <div
      className={`school-logo-container ${className}`}
      style={containerStyle}
      title={institutionName}
    >
      <img
        src={logoUrl || '/api/institution/logo'}
        alt={`${institutionName} crest`}
        onError={() => setHasError(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
        loading="lazy"
      />
    </div>
  );
}
