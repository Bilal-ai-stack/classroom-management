import React from 'react';
import { LayoutDashboard, Users, CalendarCheck, Camera, BarChart3, School } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'attendance', label: 'Daily Attendance', icon: CalendarCheck, badge: 'Phase 2' },
    { id: 'photo_review', label: 'Photo Review', icon: Camera, badge: 'Phase 3' },
    { id: 'reports', label: 'Reports', icon: BarChart3, badge: 'Phase 2' }
  ];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand-link" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('dashboard')}>
          <div style={{
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            color: '#FFFFFF',
            padding: '0.45rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <School size={22} />
          </div>
          <div>
            <span>ClassroomOS</span>
            <span className="brand-badge" style={{ marginLeft: '0.5rem' }}>MVP</span>
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
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.badge && (
                  <span style={{
                    fontSize: '0.65rem',
                    background: isActive ? '#DBEAFE' : '#F1F5F9',
                    color: isActive ? '#1D4ED8' : '#64748B',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '999px',
                    fontWeight: 700
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
