import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Camera,
  BarChart3,
  School,
  Sun,
  Moon,
  ShieldCheck,
  UserCheck,
  LogOut,
  LogIn
} from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  teacherProfile,
  onOpenAuthModal,
  onOpenPrivacyModal,
  onLogout
}) {
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
    { id: 'photo-review', label: 'Photo Review', icon: Camera },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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

          {/* Privacy & Ethics Policy Modal Trigger */}
          <button
            onClick={onOpenPrivacyModal}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem' }}
            title="Privacy & Data Ethics Controls"
            aria-label="Privacy Controls"
          >
            <ShieldCheck size={16} color="#10B981" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Privacy</span>
          </button>

          {/* Teacher Profile / Auth Badge */}
          {teacherProfile?.authenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.65rem',
                  background: 'var(--primary-light)',
                  border: '1px solid var(--primary-border)',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--primary)'
                }}
                title={`Signed in as ${teacherProfile.name} (${teacherProfile.role})`}
              >
                <UserCheck size={15} />
                <span>{teacherProfile.name.split(' ')[0]}</span>
              </div>
              <button
                onClick={onLogout}
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: '50%', width: '34px', height: '34px', padding: 0 }}
                title="Sign out of ClassroomOS"
                aria-label="Sign out"
              >
                <LogOut size={14} color="#EF4444" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem' }}
              title="Educator Login"
            >
              <LogIn size={15} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sign In</span>
            </button>
          )}

          {/* Dark / Light Mode Switch */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0 }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle color theme"
          >
            {isDarkMode ? <Sun size={16} color="#FBBF24" /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}
