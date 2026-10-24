import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, CalendarCheck, Camera, BarChart3, School, Sun, Moon } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('classroom_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('classroom_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('classroom_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'attendance', label: 'Daily Attendance', icon: CalendarCheck },
    { id: 'photo_review', label: 'Photo Review', icon: Camera },
    { id: 'reports', label: 'Reports', icon: BarChart3 }
  ];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand-link" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
          <div className="brand-icon-box">
            <School size={22} />
          </div>
          <div className="brand-text">
            <span>ClassroomOS</span>
            <span className="brand-badge">Pro</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <nav className="nav-links">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`nav-btn ${isActive ? 'active' : ''}`}
                  aria-label={item.label}
                >
                  <Icon size={18} className="nav-icon" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Dark / Light Mode Switch */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '50%', width: '38px', height: '38px', padding: 0 }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle color theme"
          >
            {isDarkMode ? <Sun size={17} color="#FBBF24" /> : <Moon size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
}
