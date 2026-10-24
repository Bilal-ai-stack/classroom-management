import React from 'react';
import { LayoutDashboard, Users, CalendarCheck, Camera, BarChart3, School } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
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
      </div>
    </header>
  );
}
