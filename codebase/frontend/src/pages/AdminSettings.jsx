import React, { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '../shared/Modal';
import SchoolLogo from '../shared/SchoolLogo';
import { adminApi, storageApi, whatsappApi } from '../shared/api';
import {
  Building2,
  Layers,
  Calendar,
  Users,
  MessageSquare,
  HardDrive,
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
  RotateCcw,
  CheckCircle,
  Send,
  Database,
  Info
} from 'lucide-react';

export default function AdminSettings({ teacherProfile, onShowToast, onInstitutionUpdated }) {
  const [subTab, setSubTab] = useState('institution'); // 'institution' | 'classes' | 'terms' | 'users' | 'whatsapp' | 'storage' | 'audit'
  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------------------------
  // 1. Institution Profile & Branding State
  // -------------------------------------------------------------------------
  const [institution, setInstitution] = useState({
    institution_name: '',
    institution_code: '',
    academic_year: '2026-2027',
    current_term: 'Fall 2026',
    contact_email: '',
    contact_phone: '',
    address: '',
    description: '',
    timezone: 'UTC',
    min_attendance_warning_rate: 75.0,
    has_custom_logo: false,
    logo_url: '/api/institution/logo'
  });
  const [originalInstitution, setOriginalInstitution] = useState(null);
  const [savingInst, setSavingInst] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(null);
  const [logoError, setLogoError] = useState('');
  const logoInputRef = useRef(null);

  // -------------------------------------------------------------------------
  // 2. Classes & Sections State
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 3. Academic Terms State
  // -------------------------------------------------------------------------
  const [termsList, setTermsList] = useState([]);
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [termForm, setTermForm] = useState({
    name: 'Spring 2027 Term',
    start_date: '2027-01-10',
    end_date: '2027-05-30',
    is_active: false
  });

  // -------------------------------------------------------------------------
  // 4. Staff Accounts State
  // -------------------------------------------------------------------------
  const [usersList, setUsersList] = useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
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

  // -------------------------------------------------------------------------
  // 5. WhatsApp Module Configuration State
  // -------------------------------------------------------------------------
  const [whatsappConfig, setWhatsappConfig] = useState({
    whatsapp_enabled: false,
    whatsapp_provider: 'cloud_api',
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    whatsapp_api_token: '',
    whatsapp_api_token_configured: false,
    whatsapp_api_token_preview: '',
    whatsapp_auto_notify_absent: false,
    whatsapp_auto_notify_late: false,
    whatsapp_template_absent: 'Dear Guardian, {student_name} was marked ABSENT today ({date}) at {school_name}. Please contact the school office if you have any questions.',
    whatsapp_template_late: 'Dear Guardian, {student_name} arrived LATE to class today ({date}) at {school_name}.'
  });
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [whatsappLogs, setWhatsappLogs] = useState([]);
  const [testPhoneInput, setTestPhoneInput] = useState('+15550001234');
  const [testMessageInput, setTestMessageInput] = useState('This is a test notification dispatched from ClassroomOS.');
  const [isTestingWhatsapp, setIsTestingWhatsapp] = useState(false);

  // -------------------------------------------------------------------------
  // 6. Database Storage & Backups State
  // -------------------------------------------------------------------------
  const [storageInfo, setStorageInfo] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // -------------------------------------------------------------------------
  // 7. Security Audit Events State
  // -------------------------------------------------------------------------
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditFilter, setAuditFilter] = useState('');

  // Stable references for parent callbacks to prevent infinite re-render loops
  const onShowToastRef = useRef(onShowToast);
  const onInstitutionUpdatedRef = useRef(onInstitutionUpdated);
  useEffect(() => {
    onShowToastRef.current = onShowToast;
    onInstitutionUpdatedRef.current = onInstitutionUpdated;
  }, [onShowToast, onInstitutionUpdated]);

  // -------------------------------------------------------------------------
  // Fetch Handlers
  // -------------------------------------------------------------------------

  const fetchInstitution = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getInstitution();
      if (res.success && res.settings) {
        setInstitution(res.settings);
        setOriginalInstitution(res.settings);
        setLogoPreviewUrl(res.settings.logo_url);
      }
    } catch (err) {
      onShowToastRef.current?.(err.message || 'Failed to load institution settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getClasses(true);
      if (res.success) {
        setClassesList(res.classes || []);
      }
    } catch (err) {
      onShowToastRef.current?.(err.message || 'Failed to load classes', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTerms = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getTerms();
      if (res.success) {
        setTermsList(res.terms || []);
      }
    } catch (err) {
      onShowToastRef.current?.(err.message || 'Failed to load academic terms', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUsers();
      if (res.success) {
        setUsersList(res.users || []);
      }
    } catch (err) {
      onShowToastRef.current?.(err.message || 'Failed to load user accounts', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWhatsapp = useCallback(async () => {
    try {
      setLoading(true);
      const [cfgRes, logsRes] = await Promise.all([
        whatsappApi.getConfig(),
        whatsappApi.getLogs()
      ]);
      if (cfgRes.success && cfgRes.config) {
        setWhatsappConfig((prev) => ({
          ...prev,
          ...cfgRes.config,
          whatsapp_api_token: ''
        }));
      }
      if (logsRes.success) {
        setWhatsappLogs(logsRes.logs || []);
      }
    } catch (err) {
      onShowToastRef.current?.(err.message || 'Failed to load WhatsApp settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStorage = useCallback(async () => {
    try {
      setLoading(true);
      const res = await storageApi.getStorageInfo();
      if (res.success) {
        setStorageInfo(res.storage);
      }
    } catch (err) {
      onShowToastRef.current?.(err.message || 'Failed to load storage details', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAuditEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getAuditEvents();
      if (res.success) {
        setAuditEvents(res.events || []);
      }
    } catch (err) {
      onShowToastRef.current?.(err.message || 'Failed to load audit events', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === 'institution') fetchInstitution();
    else if (subTab === 'classes') fetchClasses();
    else if (subTab === 'terms') fetchTerms();
    else if (subTab === 'users') fetchUsers();
    else if (subTab === 'whatsapp') fetchWhatsapp();
    else if (subTab === 'storage') fetchStorage();
    else if (subTab === 'audit') fetchAuditEvents();
  }, [subTab, fetchInstitution, fetchClasses, fetchTerms, fetchUsers, fetchWhatsapp, fetchStorage, fetchAuditEvents]);

  // -------------------------------------------------------------------------
  // 1. Institution Actions
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
        setOriginalInstitution(res.settings);
        setLogoPreviewUrl(res.settings.logo_url);
        onInstitutionUpdatedRef.current?.(res.settings);
        onShowToastRef.current?.('School logo uploaded and activated successfully!', 'success');
      }
    } catch (err) {
      setLogoError(err.message || 'Failed to upload school logo.');
      onShowToastRef.current?.(err.message || 'Logo upload failed', 'error');
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
        setOriginalInstitution(res.settings);
        setLogoPreviewUrl(res.settings.logo_url);
        onInstitutionUpdatedRef.current?.(res.settings);
        onShowToastRef.current?.('Custom logo removed. Default academic crest restored.', 'success');
      }
    } catch (err) {
      setLogoError(err.message || 'Failed to remove custom logo.');
      onShowToastRef.current?.(err.message || 'Failed to remove logo', 'error');
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
        setOriginalInstitution(res.settings);
        onInstitutionUpdatedRef.current?.(res.settings);
        onShowToastRef.current?.('Institution settings updated successfully!', 'success');
      }
    } catch (err) {
      onShowToastRef.current?.(err.message || 'Failed to save settings', 'error');
    } finally {
      setSavingInst(false);
    }
  };

  const handleResetInstitution = () => {
    if (originalInstitution) {
      setInstitution(originalInstitution);
      onShowToastRef.current?.('Changes reverted to saved values.', 'info');
    }
  };

  // -------------------------------------------------------------------------
  // 2. Class Actions
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
          name: classForm.name,
          section: classForm.section,
          room_number: classForm.room_number,
          capacity: Number(classForm.capacity),
          class_teacher_user_id: classForm.class_teacher_user_id ? Number(classForm.class_teacher_user_id) : null
        };
        await adminApi.updateClass(editingClass.id, payload);
        onShowToast?.(`Class ${classForm.name} (Section ${classForm.section}) updated successfully!`, 'success');
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
  // 3. Academic Term Actions
  // -------------------------------------------------------------------------

  const handleOpenAddTerm = () => {
    setEditingTerm(null);
    setTermForm({
      name: 'Spring 2027 Term',
      start_date: '2027-01-10',
      end_date: '2027-05-30',
      is_active: false
    });
    setIsTermModalOpen(true);
  };

  const handleOpenEditTerm = (term) => {
    setEditingTerm(term);
    setTermForm({
      name: term.name,
      start_date: term.start_date,
      end_date: term.end_date,
      is_active: term.is_active
    });
    setIsTermModalOpen(true);
  };

  const handleSaveTerm = async (e) => {
    e.preventDefault();
    try {
      if (editingTerm) {
        await adminApi.updateTerm(editingTerm.id, termForm);
        onShowToast?.(`Academic term '${termForm.name}' updated!`, 'success');
      } else {
        await adminApi.createTerm(termForm);
        onShowToast?.(`Academic term '${termForm.name}' created!`, 'success');
      }
      setIsTermModalOpen(false);
      fetchTerms();
    } catch (err) {
      onShowToast?.(err.message || 'Failed to save academic term', 'error');
    }
  };

  const handleDeleteTerm = async (term) => {
    if (!window.confirm(`Are you sure you want to delete term '${term.name}'?`)) {
      return;
    }
    try {
      await adminApi.deleteTerm(term.id);
      onShowToast?.(`Term '${term.name}' deleted.`, 'success');
      fetchTerms();
    } catch (err) {
      onShowToast?.(err.message || 'Failed to delete term', 'error');
    }
  };

  // -------------------------------------------------------------------------
  // 4. User Actions
  // -------------------------------------------------------------------------

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserForm({
      full_name: '',
      email: '',
      role: 'teacher',
      assigned_class: classesList[0]?.name || 'Grade 4',
      password: ''
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user) => {
    setEditingUser(user);
    setUserForm({
      full_name: user.name || user.full_name || '',
      email: user.email,
      role: user.role,
      assigned_class: user.assigned_class || (classesList[0]?.name || 'Grade 4'),
      password: ''
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload = {
          full_name: userForm.full_name,
          email: userForm.email,
          role: userForm.role,
          assigned_class: userForm.role === 'teacher' ? userForm.assigned_class : null
        };
        await adminApi.updateUser(editingUser.id, payload);
        onShowToast?.(`Staff details updated for ${userForm.full_name}!`, 'success');
      } else {
        const payload = {
          full_name: userForm.full_name,
          email: userForm.email,
          role: userForm.role,
          password: userForm.password,
          assigned_class: userForm.role === 'teacher' ? userForm.assigned_class : null
        };
        await adminApi.createUser(payload);
        onShowToast?.(`Account created for ${userForm.full_name}!`, 'success');
      }
      setIsUserModalOpen(false);
      fetchUsers();
    } catch (err) {
      onShowToast?.(err.message || 'Failed to save staff account', 'error');
    }
  };

  const handleToggleUserStatus = async (user) => {
    const nextStatus = !user.is_active;
    const actionText = nextStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionText} account for ${user.name}?`)) {
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
      onShowToast?.(`Password reset successfully for ${selectedUserForReset.name}. Existing sessions invalidated.`, 'success');
      setIsResetPassModalOpen(false);
      setNewPasswordInput('');
      setSelectedUserForReset(null);
    } catch (err) {
      onShowToast?.(err.message || 'Password reset failed', 'error');
    }
  };

  // -------------------------------------------------------------------------
  // 5. WhatsApp Module Actions
  // -------------------------------------------------------------------------

  const handleSaveWhatsappConfig = async (e) => {
    e.preventDefault();
    setSavingWhatsapp(true);
    try {
      const res = await whatsappApi.updateConfig(whatsappConfig);
      if (res.success && res.config) {
        setWhatsappConfig((prev) => ({
          ...prev,
          ...res.config,
          whatsapp_api_token: ''
        }));
        onShowToast?.('WhatsApp configuration and templates saved successfully!', 'success');
      }
    } catch (err) {
      onShowToast?.(err.message || 'Failed to save WhatsApp config', 'error');
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleSendTestWhatsapp = async (e) => {
    e.preventDefault();
    setIsTestingWhatsapp(true);
    try {
      const res = await whatsappApi.sendTestMessage(testPhoneInput, testMessageInput);
      if (res.success) {
        onShowToast?.(res.message || 'Test notification dispatched successfully!', 'success');
        fetchWhatsapp();
      }
    } catch (err) {
      onShowToast?.(err.message || 'Test message dispatch failed', 'error');
    } finally {
      setIsTestingWhatsapp(false);
    }
  };

  // -------------------------------------------------------------------------
  // 6. Database Storage & Backup Actions
  // -------------------------------------------------------------------------

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await storageApi.createBackup();
      if (res.success) {
        onShowToast?.(res.message || 'Verified backup created successfully!', 'success');
        fetchStorage();
      }
    } catch (err) {
      onShowToast?.(err.message || 'Backup failed', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (!window.confirm(`CAUTION: Restoring database from backup '${filename}' will roll back current tables to that point in time. An automatic safety snapshot will be created first. Proceed?`)) {
      return;
    }
    setIsRestoring(true);
    try {
      const res = await storageApi.restoreBackup(filename);
      if (res.success) {
        onShowToast?.(res.message || 'Database restored successfully!', 'success');
        fetchStorage();
      }
    } catch (err) {
      onShowToast?.(err.message || 'Restore failed', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!window.confirm(`Are you sure you want to permanently delete backup archive '${filename}'?`)) {
      return;
    }
    try {
      const res = await storageApi.deleteBackup(filename);
      if (res.success) {
        onShowToast?.(res.message || 'Backup file deleted.', 'success');
        fetchStorage();
      }
    } catch (err) {
      onShowToast?.(err.message || 'Delete backup failed', 'error');
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
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.08) 0%, rgba(15, 23, 42, 0.04) 100%)',
          border: '1px solid var(--border)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(30, 58, 138, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1E3A8A'
              }}
            >
              <Shield size={22} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Institutional Administration
            </h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            ClassroomOS 2.1 — Configure school parameters, academic structure, staff permissions, guardian notifications, and reliable local backups.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => {
              if (subTab === 'institution') fetchInstitution();
              else if (subTab === 'classes') fetchClasses();
              else if (subTab === 'terms') fetchTerms();
              else if (subTab === 'users') fetchUsers();
              else if (subTab === 'whatsapp') fetchWhatsapp();
              else if (subTab === 'storage') fetchStorage();
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
          { id: 'institution', label: 'School Profile & Branding', icon: Building2 },
          { id: 'classes', label: 'Classes & Sections', icon: Layers },
          { id: 'terms', label: 'Academic Terms', icon: Calendar },
          { id: 'users', label: 'Staff Accounts', icon: Users },
          { id: 'whatsapp', label: 'WhatsApp Module', icon: MessageSquare },
          { id: 'storage', label: 'Database & Backups', icon: HardDrive },
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
                borderBottom: isActive ? '3px solid #1E3A8A' : '3px solid transparent',
                color: isActive ? '#1E3A8A' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '0.95rem',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 1. School Profile & Branding Tab */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'institution' && (
        <form onSubmit={handleSaveInstitution} className="glass-card" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-main)' }}>
            Institution Profile, Branding & Attendance Standards
          </h2>

          {/* School Branding Section */}
          <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-color, rgba(255,255,255,0.7))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ImageIcon size={19} color="#1E3A8A" />
                  School Logo & Institutional Crest
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Active emblem appears across navigation, student portfolios, official PDF exports, and print reports.
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
                      title="Revert to standard academic crest"
                    >
                      <RotateCcw size={15} />
                      <span>Restore Default Crest</span>
                    </button>
                  )}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  <div>• Supported file types: <strong>PNG, JPG, JPEG</strong>, or securely sanitized <strong>SVG</strong>.</div>
                  <div>• Maximum file size: <strong>2 MB</strong>. Maximum raster bounds: <strong>2048 x 2048 px</strong>.</div>
                  <div>• Stored securely in application directory and preserved across updates and backups.</div>
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
                value={institution.institution_name ?? ''}
                onChange={(e) => setInstitution((prev) => ({ ...prev, institution_name: e.target.value }))}
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
                value={institution.institution_code ?? ''}
                onChange={(e) => setInstitution((prev) => ({ ...prev, institution_code: e.target.value }))}
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
                value={institution.academic_year ?? ''}
                onChange={(e) => setInstitution((prev) => ({ ...prev, academic_year: e.target.value }))}
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
                value={institution.current_term ?? ''}
                onChange={(e) => setInstitution((prev) => ({ ...prev, current_term: e.target.value }))}
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
                value={institution.contact_email ?? ''}
                onChange={(e) => setInstitution((prev) => ({ ...prev, contact_email: e.target.value }))}
                placeholder="admin@school.local"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Official Contact Phone
              </label>
              <input
                type="tel"
                className="form-input"
                value={institution.contact_phone ?? ''}
                onChange={(e) => setInstitution((prev) => ({ ...prev, contact_phone: e.target.value }))}
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
                value={institution.timezone ?? 'UTC'}
                onChange={(e) => setInstitution((prev) => ({ ...prev, timezone: e.target.value }))}
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
                Attendance Warning Threshold ({institution.min_attendance_warning_rate ?? 75}%)
              </label>
              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={institution.min_attendance_warning_rate ?? 75}
                onChange={(e) => setInstitution((prev) => ({ ...prev, min_attendance_warning_rate: parseFloat(e.target.value) }))}
                style={{ width: '100%', accentColor: '#1E3A8A' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Students falling below {institution.min_attendance_warning_rate ?? 75}% are flagged on attendance reports.
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
              Campus Physical Address
            </label>
            <input
              type="text"
              className="form-input"
              value={institution.address ?? ''}
              onChange={(e) => setInstitution((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="e.g. 123 Education Boulevard, Springfield"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
              Institution Mission & Description
            </label>
            <textarea
              className="form-textarea"
              rows={2}
              value={institution.description ?? ''}
              onChange={(e) => setInstitution((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of school ethos or administrative guidelines..."
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleResetInstitution}
              disabled={savingInst}
              style={{ padding: '0.6rem 1.25rem' }}
            >
              Reset to Saved
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={savingInst}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', backgroundColor: '#1E3A8A' }}
            >
              <Save size={18} />
              <span>{savingInst ? 'Saving Configuration...' : 'Save Configuration'}</span>
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
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#1E3A8A' }}
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
                      <span className="badge" style={{ backgroundColor: 'rgba(30, 58, 138, 0.1)', color: '#1E3A8A', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
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
                        style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.5rem', color: '#1E3A8A' }}
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
      {/* 3. Academic Terms Tab */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'terms' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Manage school academic calendar terms, semesters, and active instructional periods.
            </p>
            <button
              onClick={handleOpenAddTerm}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#1E3A8A' }}
            >
              <Plus size={16} />
              <span>Add Academic Term</span>
            </button>
          </div>

          <div className="table-container" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--border-light)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Term Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Start Date</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>End Date</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {termsList.map((term) => (
                  <tr key={term.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{term.name}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{term.start_date}</td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{term.end_date}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: term.is_active ? 'var(--success-bg)' : 'var(--border)',
                          color: term.is_active ? 'var(--success)' : 'var(--text-muted)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}
                      >
                        {term.is_active ? 'Current Active Term' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleOpenEditTerm(term)}
                        className="btn-icon"
                        title="Edit Term"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.5rem', color: '#1E3A8A' }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteTerm(term)}
                        className="btn-icon"
                        title="Delete Term"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {termsList.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No academic terms configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. Staff Accounts Tab */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Manage educator profiles, role-based access control (Admin / Teacher), and security credentials.
            </p>
            <button
              onClick={handleOpenAddUser}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#1E3A8A' }}
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
                        {u.name} {isSelf && <span style={{ fontSize: '0.75rem', color: '#1E3A8A', fontWeight: 500 }}>(You)</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{u.email}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: u.role === 'admin' ? 'rgba(30, 58, 138, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: u.role === 'admin' ? '#1E3A8A' : 'var(--success)',
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
                          onClick={() => handleOpenEditUser(u)}
                          className="btn-icon"
                          title="Edit Staff Information"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.5rem', color: '#1E3A8A' }}
                        >
                          <Edit2 size={16} />
                        </button>
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
      {/* 5. WhatsApp Module Configuration Tab */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'whatsapp' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <form onSubmit={handleSaveWhatsappConfig} className="glass-card" style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MessageSquare size={20} color="#1E3A8A" />
                  Guardian WhatsApp Notification Module
                </h2>
                <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Send individual manual WhatsApp notices from the attendance screen or configure automated Cloud API notifications.
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={whatsappConfig.whatsapp_enabled}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, whatsapp_enabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#1E3A8A' }}
                />
                <span>Enable WhatsApp Module</span>
              </label>
            </div>

            <div style={{ padding: '1rem 1.25rem', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#1E40AF', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Offline-First Assurance:</strong> Manual WhatsApp notifications use universal deep links (`https://wa.me/`) that launch WhatsApp directly on your desktop or phone without requiring API tokens. Automated messaging requires an active internet connection and WhatsApp Cloud API credentials. Attendance recording always works 100% offline.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Provider Integration
                </label>
                <select
                  className="form-select"
                  value={whatsappConfig.whatsapp_provider}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, whatsapp_provider: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="cloud_api">Meta WhatsApp Cloud API (Official)</option>
                  <option value="simulated">Simulated / Offline Development Sandbox</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Phone Number ID (Cloud API)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={whatsappConfig.whatsapp_phone_number_id}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, whatsapp_phone_number_id: e.target.value })}
                  placeholder="e.g. 104829103948"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Business Account ID (WABA)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={whatsappConfig.whatsapp_business_account_id}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, whatsapp_business_account_id: e.target.value })}
                  placeholder="e.g. 209384019283"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Access Token {whatsappConfig.whatsapp_api_token_configured && <span style={{ color: 'var(--success)' }}>({whatsappConfig.whatsapp_api_token_preview})</span>}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={whatsappConfig.whatsapp_api_token}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, whatsapp_api_token: e.target.value })}
                  placeholder={whatsappConfig.whatsapp_api_token_configured ? 'Token is configured (leave empty to keep)' : 'Paste System User Access Token'}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                Automated Attendance Triggers (Optional)
              </h3>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={whatsappConfig.whatsapp_auto_notify_absent}
                    onChange={(e) => setWhatsappConfig({ ...whatsappConfig, whatsapp_auto_notify_absent: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#1E3A8A' }}
                  />
                  <span>Automatically notify guardians when student is marked <strong>Absent</strong></span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={whatsappConfig.whatsapp_auto_notify_late}
                    onChange={(e) => setWhatsappConfig({ ...whatsappConfig, whatsapp_auto_notify_late: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#1E3A8A' }}
                  />
                  <span>Automatically notify guardians when student arrives <strong>Late</strong></span>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Absent Notification Message Template
              </label>
              <textarea
                className="form-textarea"
                rows={2}
                value={whatsappConfig.whatsapp_template_absent}
                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, whatsapp_template_absent: e.target.value })}
                style={{ width: '100%' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Supported variables: <code>{'{student_name}'}</code>, <code>{'{class_name}'}</code>, <code>{'{date}'}</code>, <code>{'{school_name}'}</code>
              </span>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-main)' }}>
                Late Arrival Notification Message Template
              </label>
              <textarea
                className="form-textarea"
                rows={2}
                value={whatsappConfig.whatsapp_template_late}
                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, whatsapp_template_late: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={savingWhatsapp}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', backgroundColor: '#1E3A8A' }}
              >
                <Save size={18} />
                <span>{savingWhatsapp ? 'Saving Configuration...' : 'Save WhatsApp Configuration'}</span>
              </button>
            </div>
          </form>

          {/* Test Dispatch Card */}
          <div className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={18} color="#1E3A8A" />
              Simulated & Live Notification Dispatch Sandbox
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Dispatch a verified test payload to a phone number. In test mode, this generates a simulated WAMID without communicating with live external WhatsApp servers.
            </p>

            <form onSubmit={handleSendTestWhatsapp} style={{ display: 'grid', gridTemplateColumns: '260px 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Recipient Phone (International E.164)
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={testPhoneInput}
                  onChange={(e) => setTestPhoneInput(e.target.value)}
                  placeholder="+1 (555) 000-1234"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Test Message Body
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={testMessageInput}
                  onChange={(e) => setTestMessageInput(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <button
                type="submit"
                className="btn-secondary"
                disabled={isTestingWhatsapp}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.25rem' }}
              >
                <Send size={16} />
                <span>{isTestingWhatsapp ? 'Dispatching...' : 'Dispatch Test'}</span>
              </button>
            </form>
          </div>

          {/* Notification Audit Log */}
          <div className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
              Recent Notification Audit Log
            </h3>
            <div className="table-container" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--border-light)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>Timestamp</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>Recipient Phone</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>Student</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>Mode</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}>Message Text</th>
                  </tr>
                </thead>
                <tbody>
                  {whatsappLogs.slice(0, 25).map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>
                      <td style={{ padding: '0.6rem 0.8rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600 }}>{log.recipient_phone}</td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>{log.student_name || '—'}</td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <span className="badge" style={{ fontSize: '0.75rem', backgroundColor: 'var(--border-light)' }}>
                          {log.mode === 'manual_link' ? 'Manual Link' : 'Automated API'}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: log.status === 'sent' || log.status === 'prepared' ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: log.status === 'sent' || log.status === 'prepared' ? 'var(--success)' : 'var(--danger)',
                            fontSize: '0.75rem'
                          }}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.6rem 0.8rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.message_text}
                      </td>
                    </tr>
                  ))}
                  {whatsappLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No WhatsApp notifications logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 6. Database Storage & Backups Tab */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'storage' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          {/* Storage Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <Database size={16} />
                <span>Primary SQLite Database</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {storageInfo?.database_size_display || '—'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={storageInfo?.database_path}>
                Path: {storageInfo?.database_path || '—'}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <HardDrive size={16} />
                <span>Disk Storage Space Free</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669' }}>
                {storageInfo?.disk_free_display || '—'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Local hard disk capacity for backups & records
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <CheckCircle size={16} />
                <span>Verified Backups</span>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1E3A8A' }}>
                {storageInfo?.backup_count || 0} Backups
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Total archive size: {storageInfo?.total_backup_size_display || '0 KB'}
              </div>
            </div>
          </div>

          {/* Backup Management Card */}
          <div className="glass-card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HardDrive size={18} color="#1E3A8A" />
                  Database Backup Archives & Safe Point-in-Time Recovery
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Backups are verified with SHA-256 cryptographic hashes and SQLite integrity checks. Restoring creates an automatic safety snapshot first.
                </p>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={handleCreateBackup}
                disabled={isBackingUp}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.55rem 1.25rem', backgroundColor: '#1E3A8A' }}
              >
                <Plus size={16} />
                <span>{isBackingUp ? 'Creating Verified Backup...' : 'Create Verified Backup Now'}</span>
              </button>
            </div>

            <div className="table-container" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--border-light)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Backup Filename</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Created Timestamp</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Archive Size</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Cryptographic Integrity</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {storageInfo?.backups?.map((bk) => (
                    <tr key={bk.filename} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        {bk.filename}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                        {bk.created_at ? new Date(bk.created_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{bk.size_display}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: bk.verified ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: bk.verified ? 'var(--success)' : 'var(--danger)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                          }}
                        >
                          {bk.verified ? 'Verified (SHA-256 Valid)' : 'Corrupted / Check Failed'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => handleRestoreBackup(bk.filename)}
                          disabled={isRestoring || !bk.verified}
                          style={{ marginRight: '0.5rem', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                          title="Restore live database from this verified snapshot"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => handleDeleteBackup(bk.filename)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                          title="Delete backup archive"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!storageInfo?.backups || storageInfo.backups.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No backup archives created yet. Click "Create Verified Backup Now" to capture an initial snapshot.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 7. Security Audit Trail Tab */}
      {/* --------------------------------------------------------------------- */}
      {subTab === 'audit' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Immutable system audit trail: attendance corrections, administrative changes, logins, backups, and overrides.
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
                  <th style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}>Actor</th>
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
                          backgroundColor: ev.action.includes('correction') || ev.action.includes('reset') || ev.action.includes('restore') ? 'var(--warning-bg)' : 'rgba(30, 58, 138, 0.12)',
                          color: ev.action.includes('correction') || ev.action.includes('reset') || ev.action.includes('restore') ? 'var(--warning)' : '#1E3A8A',
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
            <button type="submit" className="btn-primary" style={{ backgroundColor: '#1E3A8A' }}>
              {editingClass ? 'Update Class & Synchronize Roster' : 'Create Class'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Academic Term Modal */}
      <Modal
        isOpen={isTermModalOpen}
        onClose={() => setIsTermModalOpen(false)}
        title={editingTerm ? `Edit Term: ${editingTerm.name}` : 'Create Academic Calendar Term'}
      >
        <form onSubmit={handleSaveTerm}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Term Name *</label>
            <input
              type="text"
              required
              className="form-input"
              value={termForm.name}
              onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
              placeholder="e.g. Fall 2026 Term"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Start Date *</label>
              <input
                type="date"
                required
                className="form-input"
                value={termForm.start_date}
                onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>End Date *</label>
              <input
                type="date"
                required
                className="form-input"
                value={termForm.end_date}
                onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={termForm.is_active}
                onChange={(e) => setTermForm({ ...termForm, is_active: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#1E3A8A' }}
              />
              <span>Set as active instructional term</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setIsTermModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ backgroundColor: '#1E3A8A' }}>
              {editingTerm ? 'Update Term' : 'Create Term'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create / Edit Staff Account Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={editingUser ? `Edit Staff Member: ${editingUser.name}` : 'Create Educator / Staff Account'}
      >
        <form onSubmit={handleSaveUser}>
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
                <select
                  className="form-select"
                  value={userForm.assigned_class}
                  onChange={(e) => setUserForm({ ...userForm, assigned_class: e.target.value })}
                  style={{ width: '100%' }}
                >
                  {classesList.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} (Section {c.section})
                    </option>
                  ))}
                  {classesList.length === 0 && <option value="Grade 4">Grade 4</option>}
                </select>
              </div>
            )}
          </div>

          {!editingUser && (
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
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setIsUserModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ backgroundColor: '#1E3A8A' }}>
              {editingUser ? 'Update Staff Info' : 'Create Account'}
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
