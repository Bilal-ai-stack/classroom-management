import React, { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '../shared/Modal';
import SchoolLogo from '../shared/SchoolLogo';
import { adminApi } from '../shared/api';
import {
  Building2,
  Layers,
  Users,
  Shield,
  Save,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  KeyRound,
  History,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  RotateCcw
} from 'lucide-react';

export default function AdminSettings({ teacherProfile, onShowToast, onInstitutionUpdated }) {
  const [subTab, setSubTab] = useState('institution'); // 'institution' | 'classes' | 'users' | 'audit'
  const [loading, setLoading] = useState(false);

  // Institution State
  const [institution, setInstitution] = useState({
    institution_name: '',
    institution_code: '',
    academic_year: '2026-2027',
    current_term: 'Fall 2026',
    contact_email: '',
    contact_phone: '',
    address: '',
    timezone: 'UTC',
    min_attendance_warning_rate: 75.0,
    has_custom_logo: false,
    logo_url: '/api/institution/logo'
  });
  const [savingInst, setSavingInst] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [logoError, setLogoError] = useState('');
  const logoInputRef = useRef(null);

  // Classes & Sections State
  const [classesList, setClassesList] = useState([]);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [classForm, setClassForm] = useState({
    name: 'Grade 6',
    section: 'A',
    room_number: '',
    capacity: 35,
    class_teacher_user_id: ''
  });

  // Users State
  const [usersList, setUsersList] = useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    role: 'teacher',
    assigned_class: 'Grade 4',
    password: ''
  });

  // Audit Events State
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditFilter, setAuditFilter] = useState('');

  // -------------------------------------------------------------------------
  // Fetch Functions
  // -------------------------------------------------------------------------

  const fetchInstitution = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getInstitution();
      if (res.success && res.settings) {
        setInstitution(res.settings);
        setLogoPreviewUrl(res.settings.logo_url);
        onInstitutionUpdated?.(res.settings);
      }
    } catch (err) {
      onShowToast?.(err.message || 'Failed to load institution settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [onShowToast, onInstitutionUpdated]);

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getClasses(true);
      if (res.success) {
        setClassesList(res.classes || []);
      }
    } catch (err) {
      onShowToast?.(err.message || 'Failed to load classes', 'error');
    } finally {
      setLoading(false);
    }
  }, [onShowToast]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUsers();
      if (res.success) {
        setUsersList(res.users || []);
      }
    } catch (err) {
      onShowToast?.(err.message || 'Failed to load user accounts', 'error');
    } finally {
      setLoading(false);
    }
  }, [onShowToast]);

  const fetchAuditEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getAuditEvents();
      if (res.success) {
        setAuditEvents(res.events || []);
      }
    } catch (err) {
      onShowToast?.(err.message || 'Failed to load audit events', 'error');
    } finally {
      setLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    if (subTab === 'institution') fetchInstitution();
    else if (subTab === 'classes') fetchClasses();
    else if (subTab === 'users') fetchUsers();
    else if (subTab === 'audit') fetchAuditEvents();
  }, [subTab, fetchInstitution, fetchClasses, fetchUsers, fetchAuditEvents]);

  // -------------------------------------------------------------------------
  // Institution & Logo Actions
  // -------------------------------------------------------------------------

  const handleUploadLogoFile = async (file) => {
    setLogoError('');
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo file size exceeds the 2MB limit. Please choose a smaller image.');
      return;
    }
    setIsUploadingLogo(true);
    try {
      const res = await adminApi.uploadLogo(file);
      if (res.success && res.settings) {
        setInstitution(res.settings);
        setLogoPreviewUrl(res.settings.logo_url);
        onInstitutionUpdated?.(res.settings);
        onShowToast?.('School logo uploaded and activated successfully!', 'success');
      }
    } catch (err) {
      setLogoError(err.message || 'Failed to upload school logo.');
      onShowToast?.(err.message || 'Logo upload failed', 'error');
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm('Are you sure you want to remove the custom school logo and revert to the default academic crest?')) {
      return;
    }
    setIsUploadingLogo(true);
    setLogoError('');
    try {
      const res = await adminApi.removeLogo();
      if (res.success && res.settings) {
        setInstitution(res.settings);
        setLogoPreviewUrl(res.settings.logo_url);
        onInstitutionUpdated?.(res.settings);
        onShowToast?.('Custom logo removed. Default academic crest restored.', 'success');
      }
    } catch (err) {
      setLogoError(err.message || 'Failed to remove custom logo.');
      onShowToast?.(err.message || 'Failed to remove logo', 'error');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveInstitution = async (e) => {
    e.preventDefault();
    try {
      setSavingInst(true);
      const res = await adminApi.updateInstitution(institution);
      if (res.success && res.settings) {
        setInstitution(res.settings);
        onInstitutionUpdated?.(res.settings);
        onShowToast?.('Institution settings updated successfully!', 'success');
      }
    } catch (err) {
      onShowToast?.(err.message || 'Failed to save settings', 'error');
    } finally {
      setSavingInst(false);
    }
  };

  // -------------------------------------------------------------------------
  // Class / Section Actions
  // -------------------------------------------------------------------------

  const handleOpenAddClass = () => {
    setEditingClass(null);
    setClassForm({
      name: 'Grade 6',
      section: 'A',
      room_number: '',
      capacity: 35,
      class_teacher_user_id: ''
    });
    setIsClassModalOpen(true);
  };

  const handleOpenEditClass = (cls) => {
    setEditingClass(cls);
    setClassForm({
      name: cls.name,
      section: cls.section,
      room_number: cls.room_number || '',
      capacity: cls.capacity || 35,
      class_teacher_user_id: cls.class_teacher_user_id || ''
    });
    setIsClassModalOpen(true);
  };

  const handleSaveClass = async (e) => {
    e.preventDefault();
    try {
      if (editingClass) {
        const payload = {
          room_number: classForm.room_number,
          capacity: Number(classForm.capacity),
          class_teacher_user_id: classForm.class_teacher_user_id ? Number(classForm.class_teacher_user_id) : null
        };
        await adminApi.updateClass(editingClass.id, payload);
        onShowToast?.(`Class ${editingClass.name} updated successfully!`, 'success');
      } else {
        const payload = {
          name: classForm.name,
          section: classForm.section,
          room_number: classForm.room_number,
          capacity: Number(classForm.capacity),
          class_teacher_user_id: classForm.class_teacher_user_id ? Number(classForm.class_teacher_user_id) : null
        };
        await adminApi.createClass(payload);
        onShowToast?.(`Class ${classForm.name} Section ${classForm.section} created!`, 'success');
      }
      setIsClassModalOpen(false);
      fetchClasses();
    } catch (err) {
      onShowToast?.(err.message || 'Failed to save class', 'error');
    }
  };

  const handleDeleteClass = async (cls) => {
    if (!window.confirm(`Are you sure you want to remove or archive ${cls.name} Section ${cls.section}?`)) {
      return;
    }
    try {
      const res = await adminApi.deleteClass(cls.id);
      onShowToast?.(res.message || 'Class removed.', 'success');
      fetchClasses();
    } catch (err) {
      onShowToast?.(err.message || 'Failed to remove class', 'error');
    }
  };

  // -------------------------------------------------------------------------
  // User Actions
  // -------------------------------------------------------------------------

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        full_name: userForm.full_name,
        email: userForm.email,
        role: userForm.role,
        password: userForm.password,
        assigned_class: userForm.role === 'teacher' ? userForm.assigned_class : null
      };
      await adminApi.createUser(payload);
      onShowToast?.(`Account created for ${userForm.full_name}!`, 'success');
      setIsUserModalOpen(false);
      fetchUsers();
    } catch (err) {
      onShowToast?.(err.message || 'Failed to create account', 'error');
    }
  };

  const handleToggleUserStatus = async (user) => {
    const nextStatus = !user.is_active;
    const actionText = nextStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionText} ${user.name}?`)) {
      return;
    }
    try {
      await adminApi.toggleUserStatus(user.id, nextStatus);
      onShowToast?.(`User ${user.name} is now ${nextStatus ? 'active' : 'inactive'}.`, 'success');
      fetchUsers();
    } catch (err) {
      onShowToast?.(err.message || 'Failed to update user status', 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUserForReset) return;
    try {
      await adminApi.resetPassword(selectedUserForReset.id, newPasswordInput);
      onShowToast?.(`Password reset successfully for ${selectedUserForReset.name}.`, 'success');
      setIsResetPassModalOpen(false);
      setNewPasswordInput('');
      setSelectedUserForReset(null);
    } catch (err) {
      onShowToast?.(err.message || 'Password reset failed', 'error');
    }
  };

  // Filtered audit events
  const filteredEvents = auditEvents.filter((ev) => {
    if (!auditFilter) return true;
    const q = auditFilter.toLowerCase();
    return (
      ev.action?.toLowerCase().includes(q) ||
      ev.entity_type?.toLowerCase().includes(q) ||
      ev.entity_id?.toLowerCase().includes(q) ||
      JSON.stringify(ev.details || {}).toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-container" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(14, 165, 233, 0.05) 100%)',
          border: '1px solid var(--border)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)'
              }}
            >
              <Shield size={22} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Institutional Administration
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Configure school parameters, manage academic classes & sections, provision staff accounts, and review security audit logs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => {
              if (subTab === 'institution') fetchInstitution();
              else if (subTab === 'classes') fetchClasses();
              else if (subTab === 'users') fetchUsers();
              else if (subTab === 'audit') fetchAuditEvents();
            }}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '0.25rem'
        }}
      >
        {[
          { id: 'institution', label: 'School Settings', icon: Building2 },
          { id: 'classes', label: 'Classes & Sections', icon: Layers },
          { id: 'users', label: 'Staff Accounts', icon: Users },
          { id: 'audit', label: 'Security & Audit Logs', icon: History }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                border: 'none',
                background: 'none',
                borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '0.95rem'
              }}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 1. School Settings Tab */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'institution' && (
        <form onSubmit={handleSaveInstitution} className="glass-card" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-main)' }}>
            Institution Profile & Attendance Rules
          </h2>

          {/* Institution Branding & Logo Section */}
          <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-color, rgba(255,255,255,0.7))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ImageIcon size={19} color="var(--primary)" />
                  School Logo & Institution Branding
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Active crest is displayed in the navigation header, student portfolios, and official attendance reports.
                </p>
              </div>
              <span className={`badge ${institution.has_custom_logo ? 'badge-present' : 'badge-primary'}`} style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}>
                {institution.has_custom_logo ? 'Custom Logo Active' : 'Default Academic Crest'}
              </span>
            </div>

            {logoError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '1rem', fontSize: '0.85rem' }}>
                <AlertCircle size={16} />
                <span>{logoError}</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <SchoolLogo
                  logoUrl={logoPreviewUrl || institution.logo_url}
                  institutionName={institution.institution_name}
                  size={84}
                  showBorder={true}
                  rounded="lg"
                />
              </div>

              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/png, image/jpeg, image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0];
                      if (file) handleUploadLogoFile(file);
                    }}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => logoInputRef.current && logoInputRef.current.click()}
                    disabled={isUploadingLogo}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Upload size={15} />
                    <span>{isUploadingLogo ? 'Uploading...' : institution.has_custom_logo ? 'Replace School Logo' : 'Upload School Logo'}</span>
                  </button>

                  {institution.has_custom_logo && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleRemoveLogo}
                      disabled={isUploadingLogo}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#EF4444' }}
                      title="Remove custom logo and restore default academic crest"
                    >
                      <RotateCcw size={15} />
                      <span>Restore Default Crest</span>
                    </button>
                  )}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  <div>• Supported file formats: <strong>PNG, JPG, JPEG</strong>, or securely sanitized <strong>SVG</strong>.</div>
                  <div>• Maximum file size: <strong>2 MB</strong>. Maximum raster resolution: <strong>2048 x 2048 px</strong>.</div>
                  <div>• Persisted securely in application data directory across software updates and backups.</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Institution Name *
              </label>
              <input
                type="text"
                required
                className="form-input"
                value={institution.institution_name}
                onChange={(e) => setInstitution({ ...institution, institution_name: e.target.value })}
                placeholder="e.g. Springfield Academy"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Institution Code *
              </label>
              <input
                type="text"
                required
                className="form-input"
                value={institution.institution_code}
                onChange={(e) => setInstitution({ ...institution, institution_code: e.target.value })}
                placeholder="e.g. SCH-001"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Academic Year
              </label>
              <input
                type="text"
                className="form-input"
                value={institution.academic_year}
                onChange={(e) => setInstitution({ ...institution, academic_year: e.target.value })}
                placeholder="2026-2027"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Current Term
              </label>
              <input
                type="text"
                className="form-input"
                value={institution.current_term}
                onChange={(e) => setInstitution({ ...institution, current_term: e.target.value })}
                placeholder="Fall 2026"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Official Contact Email *
              </label>
              <input
                type="email"
                required
                className="form-input"
                value={institution.contact_email}
                onChange={(e) => setInstitution({ ...institution, contact_email: e.target.value })}
                placeholder="admin@school.local"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Contact Phone
              </label>
              <input
                type="tel"
                className="form-input"
                value={institution.contact_phone}
                onChange={(e) => setInstitution({ ...institution, contact_phone: e.target.value })}
                placeholder="+1 (555) 019-2834"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                System Timezone
              </label>
              <select
                className="form-select"
                value={institution.timezone}
                onChange={(e) => setInstitution({ ...institution, timezone: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="UTC">UTC (Universal Coordinated Time)</option>
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="America/Denver">Mountain Time (US & Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Asia/Karachi">Pakistan Standard Time (PKT / UTC+5)</option>
                <option value="Asia/Dubai">Gulf Standard Time (GST / UTC+4)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Attendance Warning Threshold ({institution.min_attendance_warning_rate}%)
              </label>
              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={institution.min_attendance_warning_rate}
                onChange={(e) => setInstitution({ ...institution, min_attendance_warning_rate: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Students below {institution.min_attendance_warning_rate}% are flagged as needing attention.
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
              Campus Address
            </label>
            <textarea
              className="form-textarea"
              rows={2}
              value={institution.address}
              onChange={(e) => setInstitution({ ...institution, address: e.target.value })}
              placeholder="123 Education Boulevard, Springfield"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={savingInst}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem' }}
            >
              <Save size={18} />
              <span>{savingInst ? 'Saving Settings...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. Classes & Sections Tab */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'classes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Define Grade levels, sections, assigned classrooms, and classroom teacher assignments.
            </p>
            <button
              onClick={handleOpenAddClass}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
            >
              <Plus size={16} />
              <span>Add Class / Section</span>
            </button>
          </div>

          <div className="table-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--border-light)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Class Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Section</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Room</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Enrolled / Capacity</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Class Teacher</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classesList.map((cls) => (
                  <tr key={cls.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{cls.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        Section {cls.section}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{cls.room_number || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 600 }}>{cls.enrolled_students || 0}</span>
                      <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}> / {cls.capacity}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: cls.class_teacher_name ? 'var(--text-main)' : 'var(--text-light)' }}>
                      {cls.class_teacher_name || 'Unassigned'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: cls.is_active ? 'var(--success-bg)' : 'var(--border)',
                          color: cls.is_active ? 'var(--success)' : 'var(--text-muted)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}
                      >
                        {cls.is_active ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenEditClass(cls)}
                        className="btn-icon"
                        title="Edit Class Details"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.5rem', color: 'var(--primary)' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteClass(cls)}
                        className="btn-icon"
                        title="Archive or Delete Class"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {classesList.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No academic classes configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. User Accounts Tab */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Manage educator profiles, role-based access control (Admin / Teacher), and security credentials.
            </p>
            <button
              onClick={() => {
                setUserForm({
                  full_name: '',
                  email: '',
                  role: 'teacher',
                  assigned_class: classesList[0]?.name || 'Grade 4',
                  password: ''
                });
                setIsUserModalOpen(true);
              }}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
            >
              <Plus size={16} />
              <span>Create Staff Account</span>
            </button>
          </div>

          <div className="table-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--border-light)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Staff Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Email Address</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Role</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Class Scoping</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Account Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => {
                  const isSelf = u.id === teacherProfile?.id;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                        {u.name} {isSelf && <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500 }}>(You)</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{u.email}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: u.role === 'admin' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: u.role === 'admin' ? 'var(--primary)' : 'var(--success)',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            textTransform: 'uppercase'
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        {u.role === 'admin' ? 'All Classes (Global)' : (u.assigned_class || 'Unassigned')}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: u.is_active ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: u.is_active ? 'var(--success)' : 'var(--danger)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                          }}
                        >
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setSelectedUserForReset(u);
                            setNewPasswordInput('');
                            setIsResetPassModalOpen(true);
                          }}
                          className="btn-icon"
                          title="Reset Password"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.5rem', color: 'var(--warning)' }}
                        >
                          <KeyRound size={16} />
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className="btn-icon"
                            title={u.is_active ? 'Deactivate User' : 'Activate User'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: u.is_active ? 'var(--danger)' : 'var(--success)' }}
                          >
                            {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. Audit Trail Tab */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'audit' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Immutable system audit trail: attendance corrections, administrative changes, logins, and overrides.
            </p>
            <input
              type="text"
              placeholder="Search audit actions or entity..."
              className="form-input"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
          </div>

          <div className="table-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--border-light)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Action</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Target Entity</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Actor ID</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Event Payload / Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.slice(0, 50).map((ev) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: ev.action.includes('correction') || ev.action.includes('reset') ? 'var(--warning-bg)' : 'var(--primary-light)',
                          color: ev.action.includes('correction') || ev.action.includes('reset') ? 'var(--warning)' : 'var(--primary)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 600
                        }}
                      >
                        {ev.action}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontWeight: 500 }}>{ev.entity_type}</span> {ev.entity_id && <span style={{ color: 'var(--text-light)' }}>(#{ev.entity_id})</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                      User #{ev.actor_user_id || 'System'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-main)', maxWidth: '400px', wordBreak: 'break-all' }}>
                      {JSON.stringify(ev.details || {})}
                    </td>
                  </tr>
                ))}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No audit events matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* Modals */}
      {/* --------------------------------------------------------------------- */}

      {/* Add / Edit Class Modal */}
      <Modal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        title={editingClass ? `Edit Class: ${editingClass.name} - Section ${editingClass.section}` : 'Create Academic Class'}
      >
        <form onSubmit={handleSaveClass}>
          {!editingClass && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Class / Grade *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="e.g. Grade 6"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Section *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={classForm.section}
                  onChange={(e) => setClassForm({ ...classForm, section: e.target.value })}
                  placeholder="e.g. A"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Room Number</label>
              <input
                type="text"
                className="form-input"
                value={classForm.room_number}
                onChange={(e) => setClassForm({ ...classForm, room_number: e.target.value })}
                placeholder="e.g. Room 302"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Max Capacity *</label>
              <input
                type="number"
                min="1"
                max="200"
                required
                className="form-input"
                value={classForm.capacity}
                onChange={(e) => setClassForm({ ...classForm, capacity: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Assigned Class Teacher</label>
            <select
              className="form-select"
              value={classForm.class_teacher_user_id}
              onChange={(e) => setClassForm({ ...classForm, class_teacher_user_id: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="">-- Unassigned --</option>
              {usersList
                .filter((u) => u.is_active && u.role === 'teacher')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.email})
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setIsClassModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editingClass ? 'Update Class' : 'Create Class'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Staff Account Modal */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Create Educator / Staff Account">
        <form onSubmit={handleCreateUser}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Full Name *</label>
            <input
              type="text"
              required
              className="form-input"
              value={userForm.full_name}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              placeholder="e.g. Eleanor Vance"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Email Address *</label>
            <input
              type="email"
              required
              className="form-input"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              placeholder="e.g. eleanor@school.local"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>System Role *</label>
              <select
                className="form-select"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="teacher">Teacher (Class-Scoped)</option>
                <option value="admin">Administrator (Full Access)</option>
              </select>
            </div>

            {userForm.role === 'teacher' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Assigned Class *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={userForm.assigned_class}
                  onChange={(e) => setUserForm({ ...userForm, assigned_class: e.target.value })}
                  placeholder="e.g. Grade 4"
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Initial Password *</label>
            <input
              type="password"
              required
              className="form-input"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              placeholder="Minimum 12 chars (letters + numbers)"
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Must contain at least 12 characters, including letters and numbers.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setIsUserModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isResetPassModalOpen}
        onClose={() => setIsResetPassModalOpen(false)}
        title={`Reset Password for ${selectedUserForReset?.name}`}
      >
        <form onSubmit={handleResetPassword}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Setting a new password will immediately revoke all active browser sessions for this user.
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>New Secure Password *</label>
            <input
              type="password"
              required
              className="form-input"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder="Minimum 12 chars (letters + numbers)"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setIsResetPassModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ backgroundColor: 'var(--warning)', borderColor: 'var(--warning)' }}>
              Reset Password & Invalidate Sessions
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
