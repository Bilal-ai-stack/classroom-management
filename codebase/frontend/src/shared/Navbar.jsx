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
  LogIn,
  Menu,
  X as CloseIcon
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('classroom_theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('classroom_theme', 'light');
    }
  }, [isDarkMode]);

  // Close mobile menu on tab change
  const handleTabChange = (id) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  const navItems = [
    { id: 'dashboard',    label: 'Dashboard',       icon: LayoutDashboard },
    { id: 'students',     label: 'Students',         icon: Users            },
    { id: 'attendance',   label: 'Attendance',       icon: CalendarCheck    },
    { id: 'photo-review', label: 'Photo Review',     icon: Camera           },
    { id: 'reports',      label: 'Reports',          icon: BarChart3        },
  ];

  return (
    <header className="navbar" role="banner">
      <div className="navbar-inner">

        {/* Brand */}
        <div
          className="brand-link"
          role="link"
          tabIndex={0}
          aria-label="Go to Dashboard"
          onClick={() => handleTabChange('dashboard')}
          onKeyDown={(e) => e.key === 'Enter' && handleTabChange('dashboard')}
        >
          <div className="brand-icon-box" aria-hidden="true">
            <School size={22} />
          </div>
          <div className="brand-text">
            <span>ClassroomOS</span>
            <span className="brand-badge">Pro</span>
          </div>
        </div>

        {/* Right-side controls (desktop) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

          {/* Desktop navigation links */}
          <nav className="nav-links" aria-label="Main navigation" id="main-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`nav-btn ${isActive ? 'active' : ''}`}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={18} className="nav-icon" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Privacy button */}
          <button
            onClick={onOpenPrivacyModal}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem' }}
            title="Privacy & Data Ethics Controls"
            aria-label="Open Privacy Controls"
          >
            <ShieldCheck size={16} color="#10B981" aria-hidden="true" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Privacy</span>
          </button>

          {/* Teacher Profile / Auth */}
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
                aria-label={`Signed in as ${teacherProfile.name}`}
              >
                <UserCheck size={15} aria-hidden="true" />
                <span>{teacherProfile.name.split(' ')[0]}</span>
              </div>
              <button
                onClick={onLogout}
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: '50%', width: '34px', height: '34px', padding: 0 }}
                title="Sign out of ClassroomOS"
                aria-label="Sign out"
              >
                <LogOut size={14} color="#EF4444" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem' }}
              title="Educator Login"
              aria-label="Sign in as Teacher"
            >
              <LogIn size={15} aria-hidden="true" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sign In</span>
            </button>
          )}

          {/* Dark / Light Mode Switch */}
          <button
            onClick={toggleTheme}
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0 }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode
              ? <Sun size={16} color="#FBBF24" aria-hidden="true" />
              : <Moon size={16} aria-hidden="true" />}
          </button>

          {/* Hamburger — mobile only */}
          <button
            className="btn btn-secondary btn-sm hamburger-btn"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0 }}
          >
            {mobileOpen
              ? <CloseIcon size={16} aria-hidden="true" />
              : <Menu size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown nav */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          className="mobile-nav-menu"
          aria-label="Mobile navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
