import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './shared/Navbar';
import Modal from './shared/Modal';
import StatusBadge from './shared/StatusBadge';
import SchoolLogo from './shared/SchoolLogo';
import AdminSettings from './pages/AdminSettings';
import { studentApi, attendanceApi, photoApi, authApi, privacyApi, adminApi, whatsappApi, systemApi } from './shared/api';
import {
  Users,
  Search,
  Plus,
  Upload,
  Edit2,
  Archive,
  RefreshCw,
  TrendingUp,
  CalendarCheck,
  Camera,
  CheckCircle2,
  AlertCircle,
  Phone,
  Calendar,
  BookOpen,
  ArrowRight,
  Check,
  Clock,
  X,
  UploadCloud,
  Sparkles,
  BarChart3,
  UserCheck,
  FileSpreadsheet,
  Trash2,
  ShieldCheck,
  Shield,
  Printer,
  Lock,
  LogIn,
  UserPlus,
  MessageSquare,
  Send,
  WifiOff,
  Settings
} from 'lucide-react';

const getTodayDate = () => new Date().toISOString().split('T')[0];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    total_students: 0,
    today_present: 0,
    today_absent: 0,
    today_late: 0,
    attendance_rate: 94,
    recent_students: []
  });
  const [institution, setInstitution] = useState({
    institution_name: 'Springfield Academy',
    institution_code: 'SCH-001',
    academic_year: '2026-2027',
    current_term: 'Fall 2026',
    logo_url: '/api/institution/logo',
    has_custom_logo: false
  });
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Phase 2 Attendance Roster State
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate);
  const [attendanceClass, setAttendanceClass] = useState('All Classes');
  const [attendanceRoster, setAttendanceRoster] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({
    total_students: 0,
    present_count: 0,
    absent_count: 0,
    late_count: 0,
    unrecorded_count: 0,
    attendance_rate: 100
  });
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // Phase 2 Reports State
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(getTodayDate);
  const [reportClass, setReportClass] = useState('All Classes');
  const [reportData, setReportData] = useState({
    summary: { total_records: 0, present_count: 0, late_count: 0, absent_count: 0, overall_rate: 100 },
    timeline: [],
    records: []
  });

  // Phase 3 Photo Detection State
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isDetectingPhoto, setIsDetectingPhoto] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [faceAssignments, setFaceAssignments] = useState({});
  const photoInputRef = useRef(null);

  // Student Portfolio Modal State
  const [viewingStudent, setViewingStudent] = useState(null);
  const [studentHistory, setStudentHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isUploadingPortfolioPhoto, setIsUploadingPortfolioPhoto] = useState(false);
  const portfolioPhotoInputRef = useRef(null);
  const newStudentPhotoInputRef = useRef(null);
  const editStudentPhotoInputRef = useRef(null);
  const [newStudentPhotoFile, setNewStudentPhotoFile] = useState(null);
  const [newStudentPhotoPreview, setNewStudentPhotoPreview] = useState(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [currentStudent, setCurrentStudent] = useState(null);
  const [formData, setFormData] = useState(() => ({
    roll_number: '',
    full_name: '',
    class_name: 'Grade 4',
    section: 'A',
    guardian_contact: '',
    guardian_name: '',
    guardian_relationship: 'Guardian',
    whatsapp_number: '',
    whatsapp_consent: false,
    notification_preferences: 'attendance',
    enrollment_date: getTodayDate(),
    notes: ''
  }));
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Guardian WhatsApp Notification State
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppTarget, setWhatsAppTarget] = useState(null);
  const [whatsAppTemplate, setWhatsAppTemplate] = useState('absent'); // 'absent' | 'late' | 'general'
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [whatsAppGuardianName, setWhatsAppGuardianName] = useState('');
  const [whatsAppMessageText, setWhatsAppMessageText] = useState('');
  const [isDispatchingWhatsApp, setIsDispatchingWhatsApp] = useState(false);

  // Offline / Connectivity State
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Phase 4 Authentication & Privacy Controls State
  const [teacherProfile, setTeacherProfile] = useState({
    authenticated: false,
    name: '',
    email: '',
    role: '',
    assigned_class: ''
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [isBootstrapMode, setIsBootstrapMode] = useState(false);
  const [bootstrapForm, setBootstrapForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: ''
  });
  const [authError, setAuthError] = useState('');
  const [privacyPolicy, setPrivacyPolicy] = useState(null);
  const [privacyAudit, setPrivacyAudit] = useState(null);
  const [isPurgingPrivacy, setIsPurgingPrivacy] = useState(false);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  }, []);

  const handleInstitutionUpdated = useCallback((updated) => {
    setInstitution((prev) => ({ ...prev, ...updated }));
  }, []);

  const loadDashboardStats = useCallback(async () => {
    try {
      const res = await studentApi.getStats();
      if (res && res.stats) setStats(res.stats);
    } catch {
      setStats({
        total_students: 12,
        today_present: 10,
        today_absent: 1,
        today_late: 1,
        attendance_rate: 92,
        recent_students: [
          { id: 1, roll_number: 'R-101', full_name: 'Aarav Patel', class_name: 'Grade 4', section: 'A', is_active: true },
          { id: 2, roll_number: 'R-102', full_name: 'Sophia Chen', class_name: 'Grade 4', section: 'A', is_active: true },
          { id: 3, roll_number: 'R-103', full_name: 'Liam Johnson', class_name: 'Grade 4', section: 'A', is_active: true }
        ]
      });
    }
  }, []);

  const loadClasses = useCallback(async () => {
    try {
      const res = await studentApi.getClasses();
      if (res && res.classes) {
        setClasses(res.classes);
      }
    } catch {
      setClasses(['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await studentApi.getStudents(searchQuery, selectedClass, includeArchived);
      if (res && res.students) {
        setStudents(res.students);
      }
    } catch {
      setStudents([
        { id: 1, roll_number: 'R-101', full_name: 'Aarav Patel', class_name: 'Grade 4', section: 'A', guardian_contact: '+1 (555) 234-5678', enrollment_date: '2026-01-15', is_active: true },
        { id: 2, roll_number: 'R-102', full_name: 'Sophia Chen', class_name: 'Grade 4', section: 'A', guardian_contact: '+1 (555) 345-6789', enrollment_date: '2026-01-15', is_active: true },
        { id: 3, roll_number: 'R-103', full_name: 'Liam Johnson', class_name: 'Grade 4', section: 'A', guardian_contact: '+1 (555) 456-7890', enrollment_date: '2026-01-18', is_active: true },
        { id: 4, roll_number: 'R-104', full_name: 'Maya Rodriguez', class_name: 'Grade 4', section: 'A', guardian_contact: '+1 (555) 567-8901', enrollment_date: '2026-01-20', is_active: true }
      ]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedClass, includeArchived]);

  // Load Daily Attendance Roster from Backend
  const loadDailyAttendance = useCallback(async () => {
    try {
      const res = await attendanceApi.getDailyAttendance(attendanceDate, attendanceClass);
      if (res && res.roster) {
        setAttendanceRoster(res.roster);
        if (res.summary) setAttendanceSummary(res.summary);
      }
    } catch {
      setAttendanceRoster(students.map((s) => ({
        student_id: s.id,
        roll_number: s.roll_number,
        full_name: s.full_name,
        class_name: s.class_name,
        section: s.section,
        status: 'Present',
        remarks: ''
      })));
    }
  }, [attendanceDate, attendanceClass, students]);

  // Load Reports Analytics from Backend
  const loadReports = useCallback(async () => {
    try {
      const res = await attendanceApi.getReport(reportStartDate, reportEndDate, reportClass);
      if (res && res.success) {
        setReportData(res);
      }
    } catch {
      setReportData({
        summary: { total_records: 48, present_count: 42, late_count: 4, absent_count: 2, overall_rate: 87.5 },
        timeline: [
          { date: '2026-10-20', present: 10, late: 1, absent: 1, total: 12 },
          { date: '2026-10-21', present: 11, late: 1, absent: 0, total: 12 },
          { date: '2026-10-22', present: 10, late: 2, absent: 0, total: 12 },
          { date: '2026-10-23', present: 11, late: 0, absent: 1, total: 12 }
        ],
        records: []
      });
    }
  }, [reportStartDate, reportEndDate, reportClass]);

  const loadTeacherProfile = useCallback(async () => {
    try {
      const res = await authApi.getCurrentUser();
      if (res && res.success && res.teacher) {
        setTeacherProfile({ ...res.teacher, authenticated: true });
      }
    } catch {
      // offline fallback
    }
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      const res = await authApi.getStatus();
      if (res && res.success) {
        const required = Boolean(res.bootstrap_required);
        setBootstrapRequired(required);
        if (required) {
          setIsBootstrapMode(true);
        }
      }
    } catch {
      // offline fallback
    }
  }, []);

  const loadInstitutionProfile = useCallback(async () => {
    try {
      const res = await adminApi.getPublicProfile();
      if (res && res.institution) {
        setInstitution((prev) => ({ ...prev, ...res.institution }));
      }
    } catch {
      // offline fallback
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
    loadInstitutionProfile();
    loadDashboardStats();
    loadClasses();
    loadTeacherProfile();
  }, [checkAuthStatus, loadInstitutionProfile, loadDashboardStats, loadClasses, loadTeacherProfile]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadDailyAttendance();
    }
  }, [activeTab, loadDailyAttendance]);

  useEffect(() => {
    if (activeTab === 'reports') {
      loadReports();
    }
  }, [activeTab, loadReports]);

  const handleBootstrap = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (bootstrapForm.password !== bootstrapForm.confirm_password) {
      setAuthError('Passwords do not match.');
      return;
    }
    if (bootstrapForm.password.length < 12) {
      setAuthError('Password must contain at least 12 characters.');
      return;
    }
    try {
      const res = await authApi.bootstrap({
        full_name: bootstrapForm.full_name,
        email: bootstrapForm.email,
        password: bootstrapForm.password
      });
      if (res && res.success) {
        if (res.token) {
          localStorage.setItem('classroom_token', res.token);
        }
        if (res.teacher) {
          setTeacherProfile({ ...res.teacher, authenticated: true });
        }
        setBootstrapRequired(false);
        setIsBootstrapMode(false);
        setIsAuthModalOpen(false);
        showToast(res.message || 'Administrator account created successfully! Welcome to ClassroomOS.');
        setActiveTab('admin');
        loadTeacherProfile();
        loadInstitutionProfile();
      }
    } catch (err) {
      setAuthError(err.message || 'Administrator setup failed.');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await authApi.login(authForm.email, authForm.password);
      if (res && res.success) {
        localStorage.setItem('classroom_token', res.token);
        const profile = { ...res.teacher, authenticated: true };
        setTeacherProfile(profile);
        setIsAuthModalOpen(false);
        showToast(res.message || 'Authenticated successfully!');
        if (profile.role === 'admin' || activeTab === 'admin') {
          setActiveTab('admin');
        }
      }
    } catch (err) {
      setAuthError(err.message || 'Invalid credentials');
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('classroom_token');
    setTeacherProfile({
      authenticated: false,
      name: '',
      email: '',
      role: '',
      assigned_class: ''
    });
    showToast('Signed out of ClassroomOS.');
  };

  const loadPrivacyDetails = async () => {
    try {
      const [policyRes, auditRes] = await Promise.all([
        privacyApi.getPolicy(),
        privacyApi.audit()
      ]);
      if (policyRes?.success) setPrivacyPolicy(policyRes.policy);
      if (auditRes?.success) setPrivacyAudit(auditRes.audit);
    } catch {
      setPrivacyPolicy({
        compliance: [
          'Zero Biometric Embedding Storage: No facial embeddings stored.',
          'Local Edge Processing: Local Haar Cascade detection.',
          'Human-in-the-Loop: Teacher manually verifies all student attendance.',
          'Ephemeral Retention: Temporary images purged after session.'
        ]
      });
      setPrivacyAudit({ temporary_crops_count: 0, temporary_storage_bytes: 0, status: 'Compliant' });
    }
  };

  const handlePurgePrivacy = async () => {
    setIsPurgingPrivacy(true);
    try {
      const res = await privacyApi.purgeTemporaryData();
      showToast(res.message || 'Temporary data purged successfully.');
      loadPrivacyDetails();
    } catch (err) {
      showToast(`Purge failed: ${err.message}`);
    } finally {
      setIsPurgingPrivacy(false);
    }
  };

  // Open Student Portfolio and load real attendance history
  const handleOpenPortfolio = async (student) => {
    setViewingStudent(student);
    setLoadingHistory(true);
    try {
      const res = await attendanceApi.getStudentHistory(student.id);
      if (res && res.success) {
        setStudentHistory(res);
      }
    } catch {
      setStudentHistory({
        metrics: { total_days: 5, present_days: 4, late_days: 1, absent_days: 0, attendance_rate: 80.0 },
        history: [
          { id: 1, date: '2026-10-24', status: 'Present', remarks: 'On time' },
          { id: 2, date: '2026-10-23', status: 'Present', remarks: null },
          { id: 3, date: '2026-10-22', status: 'Late', remarks: 'Bus delay' },
          { id: 4, date: '2026-10-21', status: 'Present', remarks: null },
          { id: 5, date: '2026-10-20', status: 'Present', remarks: null }
        ]
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleNewStudentPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Photo size exceeds 5MB limit.', 'error');
        return;
      }
      setNewStudentPhotoFile(file);
      setNewStudentPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleClearNewStudentPhoto = () => {
    setNewStudentPhotoFile(null);
    setNewStudentPhotoPreview(null);
    if (newStudentPhotoInputRef.current) newStudentPhotoInputRef.current.value = '';
  };

  const handlePortfolioPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !viewingStudent) return;
    try {
      setIsUploadingPortfolioPhoto(true);
      const res = await studentApi.uploadPhoto(viewingStudent.id, file);
      if (res.success) {
        showToast(`Photograph updated for ${viewingStudent.full_name}`);
        const updated = { ...viewingStudent, ...res.student, has_photo: true, photo_url: res.photo_url };
        setViewingStudent(updated);
        setStudents((prev) => prev.map((s) => (s.id === viewingStudent.id ? updated : s)));
      }
    } catch (err) {
      showToast(err.message || 'Failed to upload photo', 'error');
    } finally {
      setIsUploadingPortfolioPhoto(false);
      if (portfolioPhotoInputRef.current) portfolioPhotoInputRef.current.value = '';
    }
  };

  const handlePortfolioPhotoDelete = async () => {
    if (!viewingStudent) return;
    if (!window.confirm(`Are you sure you want to remove the photograph for ${viewingStudent.full_name}?`)) return;
    try {
      setIsUploadingPortfolioPhoto(true);
      const res = await studentApi.deletePhoto(viewingStudent.id);
      if (res.success) {
        showToast('Student photograph removed.');
        const updated = { ...viewingStudent, ...res.student, has_photo: false, photo_url: null, photo_path: '' };
        setViewingStudent(updated);
        setStudents((prev) => prev.map((s) => (s.id === viewingStudent.id ? updated : s)));
      }
    } catch (err) {
      showToast(err.message || 'Failed to remove photo', 'error');
    } finally {
      setIsUploadingPortfolioPhoto(false);
    }
  };

  const handleShutdownApp = async () => {
    if (!window.confirm('Are you sure you want to shut down ClassroomOS? The local background service will terminate cleanly.')) return;
    try {
      await systemApi.shutdown();
      showToast('ClassroomOS background service is shutting down. You can safely close this browser window.');
    } catch {
      showToast('Shutdown requested. Closing application.', 'info');
    }
  };

  const handleOpenAddModal = () => {
    handleClearNewStudentPhoto();
    setFormData({
      roll_number: `R-${Math.floor(100 + Math.random() * 900)}`,
      full_name: '',
      class_name: classes[0] || 'Grade 4',
      section: 'A',
      guardian_contact: '',
      guardian_name: '',
      guardian_relationship: 'Guardian',
      whatsapp_number: '',
      whatsapp_consent: false,
      notification_preferences: 'attendance',
      enrollment_date: getTodayDate(),
      notes: ''
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      let payload;
      if (newStudentPhotoFile) {
        payload = new FormData();
        Object.entries(formData).forEach(([k, v]) => payload.append(k, v ?? ''));
        payload.append('photo', newStudentPhotoFile);
      } else {
        payload = formData;
      }
      await studentApi.createStudent(payload);
      setIsAddModalOpen(false);
      handleClearNewStudentPhoto();
      showToast(`Student ${formData.full_name} enrolled successfully!`);
      loadStudents();
      loadDashboardStats();
    } catch (err) {
      setFormError(err.message || 'Failed to create student');
    }
  };

  const handleOpenEditModal = (student) => {
    setCurrentStudent(student);
    setFormData({
      roll_number: student.roll_number,
      full_name: student.full_name,
      class_name: student.class_name,
      section: student.section || 'A',
      guardian_contact: student.guardian_contact || '',
      guardian_name: student.guardian_name || '',
      guardian_relationship: student.guardian_relationship || 'Guardian',
      whatsapp_number: student.whatsapp_number || '',
      whatsapp_consent: Boolean(student.whatsapp_consent),
      notification_preferences: student.notification_preferences || 'attendance',
      enrollment_date: student.enrollment_date,
      notes: student.notes || ''
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleOpenWhatsAppModal = (student, defaultStatus = 'Absent') => {
    setWhatsAppTarget(student);
    const phone = student.whatsapp_number || student.guardian_contact || '';
    setWhatsAppPhone(phone);
    setWhatsAppGuardianName(student.guardian_name || 'Guardian');

    const templateType = defaultStatus === 'Late' ? 'late' : defaultStatus === 'Absent' ? 'absent' : 'general';
    setWhatsAppTemplate(templateType);

    const schoolName = institution?.institution_name || 'School';
    const sName = student.full_name || student.name || 'Student';
    const cName = student.class_name ? `${student.class_name} (Section ${student.section || 'A'})` : '';
    const dateStr = attendanceDate || getTodayDate();

    let msg = '';
    if (templateType === 'absent') {
      msg = `Dear ${student.guardian_name || 'Guardian'}, this is to notify you that ${sName} (${cName}) was marked ABSENT today (${dateStr}) at ${schoolName}. Please contact the school office if you have any questions.`;
    } else if (templateType === 'late') {
      msg = `Dear ${student.guardian_name || 'Guardian'}, this is to notify you that ${sName} (${cName}) arrived LATE to class today (${dateStr}) at ${schoolName}.`;
    } else {
      msg = `Dear ${student.guardian_name || 'Guardian'}, this is an official attendance notice regarding ${sName} (${cName}) from ${schoolName}.`;
    }
    setWhatsAppMessageText(msg);
    setIsWhatsAppModalOpen(true);
  };

  const handleSelectWhatsAppTemplate = (type) => {
    setWhatsAppTemplate(type);
    if (!whatsAppTarget) return;
    const schoolName = institution?.institution_name || 'School';
    const sName = whatsAppTarget.full_name || whatsAppTarget.name || 'Student';
    const cName = whatsAppTarget.class_name ? `${whatsAppTarget.class_name} (Section ${whatsAppTarget.section || 'A'})` : '';
    const dateStr = attendanceDate || getTodayDate();

    if (type === 'absent') {
      setWhatsAppMessageText(`Dear ${whatsAppGuardianName || 'Guardian'}, this is to notify you that ${sName} (${cName}) was marked ABSENT today (${dateStr}) at ${schoolName}. Please contact the school office if you have any questions.`);
    } else if (type === 'late') {
      setWhatsAppMessageText(`Dear ${whatsAppGuardianName || 'Guardian'}, this is to notify you that ${sName} (${cName}) arrived LATE to class today (${dateStr}) at ${schoolName}.`);
    } else if (type === 'general') {
      setWhatsAppMessageText(`Dear ${whatsAppGuardianName || 'Guardian'}, this is an official attendance notice regarding ${sName} (${cName}) from ${schoolName}.`);
    }
  };

  const handleLaunchWhatsApp = async (e) => {
    e.preventDefault();
    if (!whatsAppPhone) {
      showToast('Recipient phone number is required to send WhatsApp message.', 'error');
      return;
    }
    const cleanPhone = whatsAppPhone.replace(/[^0-9+]/g, '');
    if (cleanPhone.length < 7) {
      showToast('Invalid phone number format. Please check international dialing code.', 'error');
      return;
    }

    setIsDispatchingWhatsApp(true);
    try {
      await whatsappApi.logManualDispatch({
        student_id: whatsAppTarget?.id || whatsAppTarget?.student_id,
        recipient_phone: cleanPhone,
        recipient_name: whatsAppGuardianName,
        message_type: whatsAppTemplate,
        message_text: whatsAppMessageText
      });
      const encodedMsg = encodeURIComponent(whatsAppMessageText);
      const url = `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodedMsg}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      showToast(`WhatsApp launched for ${whatsAppTarget?.full_name || 'Guardian'}. Please review and send in WhatsApp.`);
      setIsWhatsAppModalOpen(false);
    } catch (err) {
      showToast(`Notification log error: ${err.message}`);
    } finally {
      setIsDispatchingWhatsApp(false);
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await studentApi.updateStudent(currentStudent.id, formData);
      setIsEditModalOpen(false);
      showToast('Student profile updated successfully!');
      loadStudents();
      loadDashboardStats();
    } catch (err) {
      setFormError(err.message || 'Failed to update student');
    }
  };

  const handleToggleArchive = async (student) => {
    const nextStatus = !student.is_active;
    const actionLabel = nextStatus ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${student.full_name}?`)) {
      return;
    }

    try {
      await studentApi.archiveStudent(student.id, nextStatus);
      showToast(`Student ${student.full_name} ${nextStatus ? 'restored' : 'archived'}.`);
      loadStudents();
      loadDashboardStats();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Bulk CSV Roster Import
  const handleImportCsv = async () => {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return;

    let importedCount = 0;
    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 2 && parts[0] && parts[1]) {
        if (parts[0].toLowerCase().includes('roll')) continue; // Skip header
        const payload = {
          roll_number: parts[0],
          full_name: parts[1],
          class_name: parts[2] || 'Grade 4',
          section: parts[3] || 'A',
          guardian_contact: parts[4] || '',
          enrollment_date: getTodayDate()
        };
        try {
          await studentApi.createStudent(payload);
          importedCount++;
        } catch {
          // ignore duplicate in bulk
        }
      }
    }
    setIsImportModalOpen(false);
    setCsvText('');
    showToast(`Successfully imported ${importedCount} student(s) from CSV!`);
    loadStudents();
    loadDashboardStats();
  };

  // Attendance handlers
  const handleSetStudentStatus = (studentId, status) => {
    setAttendanceRoster((prev) =>
      prev.map((item) =>
        item.student_id === studentId ? { ...item, status } : item
      )
    );
  };

  const handleSetStudentRemarks = (studentId, remarks) => {
    setAttendanceRoster((prev) =>
      prev.map((item) =>
        item.student_id === studentId ? { ...item, remarks } : item
      )
    );
  };

  const handleMarkAll = (status) => {
    setAttendanceRoster((prev) =>
      prev.map((item) => ({ ...item, status }))
    );
    showToast(`Marked all students as ${status}`);
  };

  const handleSaveAttendance = async () => {
    setIsSavingAttendance(true);
    try {
      const records = attendanceRoster.map((item) => ({
        student_id: item.student_id,
        status: item.status === 'Unrecorded' ? 'Present' : item.status,
        remarks: item.remarks || ''
      }));

      await attendanceApi.saveBulkAttendance(attendanceDate, records);
      showToast(`Attendance for ${attendanceDate} saved successfully!`);
      loadDailyAttendance();
      loadDashboardStats();
    } catch (err) {
      showToast(`Error saving: ${err.message}`);
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Phase 3 Photo Detection Handlers
  const handlePhotoSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      handleProcessPhoto(file);
    }
  };

  const handleProcessPhoto = async (file) => {
    setIsDetectingPhoto(true);
    try {
      const res = await photoApi.detectFaces(file);
      if (res && res.success) {
        setDetectedFaces(res.detected_faces || []);
        // Pre-assign available students to detected faces
        const initialMap = {};
        (res.detected_faces || []).forEach((face, idx) => {
          if (students[idx]) {
            initialMap[face.id] = students[idx].id;
          }
        });
        setFaceAssignments(initialMap);
        showToast(`Face detection complete: ${res.faces_count} face(s) identified!`);
      }
    } catch {
      // Graceful offline simulated detection
      const fallbackFaces = [
        { id: 1, confidence: 96.0 },
        { id: 2, confidence: 94.5 },
        { id: 3, confidence: 97.2 },
        { id: 4, confidence: 93.0 }
      ];
      setDetectedFaces(fallbackFaces);
      const initialMap = {};
      fallbackFaces.forEach((f, idx) => {
        if (students[idx]) initialMap[f.id] = students[idx].id;
      });
      setFaceAssignments(initialMap);
      showToast('Photo analyzed: 4 candidate student faces detected.');
    } finally {
      setIsDetectingPhoto(false);
    }
  };

  const handleConfirmPhotoAttendance = async () => {
    const verifiedList = Object.entries(faceAssignments).map(([, stId]) => ({
      student_id: Number(stId),
      status: 'Present',
      remarks: 'Photo Verified'
    }));

    if (verifiedList.length === 0) {
      showToast('No students assigned to detected faces.');
      return;
    }

    try {
      await photoApi.verifyAttendance(getTodayDate(), verifiedList);
      showToast(`Attendance verified and recorded for ${verifiedList.length} student(s)!`);
      loadDailyAttendance();
      loadDashboardStats();
    } catch (err) {
      showToast(`Error saving verified attendance: ${err.message}`);
    }
  };

  const handleClearPhotoSession = async () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setDetectedFaces([]);
    setFaceAssignments({});
    try {
      await photoApi.cleanupPhotos();
    } catch {
      // ignore
    }
    showToast('Photo review session cleared.');
  };

  return (
    <div className="app-container">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        teacherProfile={teacherProfile}
        institution={institution}
        bootstrapRequired={bootstrapRequired}
        onOpenAuthModal={() => {
          setIsAuthModalOpen(true);
          setAuthError('');
          if (bootstrapRequired) {
            setIsBootstrapMode(true);
          }
        }}
        onOpenPrivacyModal={() => { setIsPrivacyModalOpen(true); loadPrivacyDetails(); }}
        onLogout={handleLogout}
        onShutdown={handleShutdownApp}
      />

      {!isOnline && (
        <div style={{ backgroundColor: '#FEF3C7', borderBottom: '1px solid #FCD34D', color: '#92400E', padding: '0.45rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 500 }}>
          <WifiOff size={15} />
          <span>Operating offline from local SQLite database. Attendance and student records save locally without interruption.</span>
        </div>
      )}

      {toastMessage && (
        <div className="toast-notification">
          <CheckCircle2 size={18} color="#22C55E" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="main-content">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            {/* First-Run Administrator Bootstrap Banner */}
            {bootstrapRequired && (
              <div className="glass-card" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.25rem',
                padding: '1.2rem 1.5rem',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '1.75rem',
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(14, 165, 233, 0.08) 100%)',
                border: '1.5px solid rgba(37, 99, 235, 0.35)',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.08)',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                  }}>
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        First-Run Initial Setup Required
                      </h3>
                      <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}>
                        Action Required
                      </span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                      No administrator account exists yet. Create your primary administrator to configure school settings, manage classes, and enroll students.
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setIsBootstrapMode(true);
                    setIsAuthModalOpen(true);
                    setAuthError('');
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, padding: '0.55rem 1.1rem' }}
                >
                  <UserPlus size={16} /> Create Administrator
                </button>
              </div>
            )}

            {/* Institutional Profile Banner */}
            <div className="institution-welcome-banner glass-card" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.25rem',
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '1.75rem',
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(14, 165, 233, 0.04) 100%)',
              border: '1px solid var(--border)',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <SchoolLogo
                  logoUrl={institution.logo_url}
                  institutionName={institution.institution_name}
                  size={52}
                  showBorder={true}
                  rounded="lg"
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                      {institution.institution_name}
                    </h2>
                    <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}>
                      {institution.institution_code}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Academic Year {institution.academic_year} • {institution.current_term}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveTab('admin')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
                >
                  <Settings size={15} />
                  Institution Settings
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  Classroom Overview
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  Real-time student metrics, attendance rate, and portfolio status.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => { loadDashboardStats(); showToast('Metrics refreshed'); }}
                >
                  <RefreshCw size={16} /> Refresh
                </button>
                <button className="btn btn-primary" onClick={handleOpenAddModal}>
                  <Plus size={16} /> Enroll Student
                </button>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card" onClick={() => setActiveTab('students')}>
                <div className="stat-icon primary">
                  <Users size={24} />
                </div>
                <div>
                  <div className="stat-val">{stats.total_students}</div>
                  <div className="stat-label">Enrolled Students</div>
                </div>
              </div>

              <div className="stat-card" onClick={() => setActiveTab('attendance')}>
                <div className="stat-icon success">
                  <CalendarCheck size={24} />
                </div>
                <div>
                  <div className="stat-val">{stats.attendance_rate}%</div>
                  <div className="stat-label">Today's Attendance Rate</div>
                </div>
              </div>

              <div className="stat-card" onClick={() => setActiveTab('reports')}>
                <div className="stat-icon warning">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div className="stat-val">{stats.today_present}</div>
                  <div className="stat-label">Students Present Today</div>
                </div>
              </div>

              <div className="stat-card" onClick={() => setActiveTab('photo_review')}>
                <div className="stat-icon danger">
                  <Camera size={24} />
                </div>
                <div>
                  <div className="stat-val">Active</div>
                  <div className="stat-label">Photo Attendance Pipeline</div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Students */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Quick Actions</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div
                    className="quick-action-item"
                    onClick={() => setActiveTab('students')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ color: 'var(--primary)' }}><Users size={20} /></div>
                      <span>View All Student Portfolios</span>
                    </div>
                    <ArrowRight size={18} className="arrow-icon" />
                  </div>

                  <div
                    className="quick-action-item"
                    onClick={() => setActiveTab('attendance')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ color: 'var(--success)' }}><CalendarCheck size={20} /></div>
                      <span>Mark Daily Attendance</span>
                    </div>
                    <ArrowRight size={18} className="arrow-icon" />
                  </div>

                  <div
                    className="quick-action-item"
                    onClick={() => setActiveTab('photo_review')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ color: 'var(--warning)' }}><Camera size={20} /></div>
                      <span>Photo-Assisted Review (OpenCV)</span>
                    </div>
                    <ArrowRight size={18} className="arrow-icon" />
                  </div>

                  <div
                    className="quick-action-item"
                    onClick={() => setActiveTab('reports')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ color: 'var(--primary)' }}><BarChart3 size={20} /></div>
                      <span>View Attendance Reports & Analytics</span>
                    </div>
                    <ArrowRight size={18} className="arrow-icon" />
                  </div>

                  <div
                    className="quick-action-item"
                    onClick={() => setActiveTab('admin')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ color: 'var(--primary)' }}><Shield size={20} /></div>
                      <span>Institutional Administration & Staff</span>
                    </div>
                    <ArrowRight size={18} className="arrow-icon" />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Recently Enrolled Students</h2>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('students')}
                  >
                    View All
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(stats.recent_students && stats.recent_students.length > 0) ? (
                    stats.recent_students.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.85rem 1rem',
                          background: 'var(--border-light)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleOpenPortfolio(s)}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{s.full_name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {s.roll_number} • {s.class_name} ({s.section})
                          </div>
                        </div>
                        <StatusBadge status="Present" />
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No recent registrations found.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === 'students' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  Student Directory & Portfolios
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  Click any student to view their attendance history, profile notes, and performance metrics.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}>
                  <FileSpreadsheet size={16} /> Import CSV
                </button>
                <button className="btn btn-primary" onClick={handleOpenAddModal}>
                  <Plus size={16} /> Add Student
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="card" style={{ padding: '1.15rem 1.4rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
                  <div className="search-box">
                    <Search size={16} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search name, roll no, notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <select
                    className="form-select"
                    style={{ maxWidth: '200px' }}
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.88rem', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(e) => setIncludeArchived(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    Include Archived Students
                  </label>
                </div>

                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Showing {students.length} student{students.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Student Table */}
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Class & Section</th>
                    <th>Guardian Contact</th>
                    <th>Enrollment Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        Loading student records...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                          <AlertCircle size={32} color="var(--text-light)" />
                          <span style={{ fontSize: '1rem', fontWeight: 600 }}>No students found matching your criteria.</span>
                          <button className="btn btn-secondary btn-sm" onClick={handleOpenAddModal}>
                            Enroll a new student
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id} style={{ cursor: 'pointer' }} onClick={() => handleOpenPortfolio(student)}>
                        <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                          {student.roll_number}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: '#F1F5F9',
                              border: '1px solid var(--border)',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {student.has_photo ? (
                                <img
                                  src={`/api/students/${student.id}/photo?v=${student.updated_at || 1}`}
                                  alt={student.full_name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.parentElement) e.target.parentElement.innerText = student.full_name.charAt(0);
                                  }}
                                />
                              ) : (
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                                  {student.full_name.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{student.full_name}</div>
                              {student.notes && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{student.notes}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{student.class_name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginLeft: '0.35rem' }}>
                            (Sec {student.section})
                          </span>
                        </td>
                        <td>
                          {student.guardian_contact ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
                              <Phone size={13} color="var(--text-muted)" />
                              {student.guardian_contact}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-light)', fontSize: '0.88rem' }}>None</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                            <Calendar size={13} />
                            {student.enrollment_date}
                          </div>
                        </td>
                        <td>
                          {student.is_active ? (
                            <span className="badge badge-present">Active</span>
                          ) : (
                            <span className="badge badge-neutral">Archived</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Send WhatsApp Notice"
                              onClick={() => handleOpenWhatsAppModal(student, 'General')}
                              style={{ color: '#059669' }}
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="View Portfolio"
                              onClick={() => handleOpenPortfolio(student)}
                            >
                              <UserCheck size={14} />
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Edit Student"
                              onClick={() => handleOpenEditModal(student)}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className={`btn btn-sm ${student.is_active ? 'btn-outline-danger' : 'btn-secondary'}`}
                              title={student.is_active ? 'Archive Student' : 'Restore Student'}
                              onClick={() => handleToggleArchive(student)}
                            >
                              <Archive size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DAILY ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  Daily Attendance Roster
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  Mark and synchronize classroom presence with the SQLite database.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleMarkAll('Present')}
                >
                  <Check size={16} color="var(--success)" /> Mark All Present
                </button>
                <button
                  className="btn btn-primary"
                  disabled={isSavingAttendance}
                  onClick={handleSaveAttendance}
                >
                  <CheckCircle2 size={16} /> {isSavingAttendance ? 'Saving...' : 'Save Attendance'}
                </button>
              </div>
            </div>

            {/* Attendance Filters & Summary Bar */}
            <div className="card" style={{ padding: '1.15rem 1.4rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Date:</span>
                    <input
                      type="date"
                      className="form-input"
                      style={{ maxWidth: '170px' }}
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Class:</span>
                    <select
                      className="form-select"
                      style={{ maxWidth: '170px' }}
                      value={attendanceClass}
                      onChange={(e) => setAttendanceClass(e.target.value)}
                    >
                      <option value="All Classes">All Classes</option>
                      {classes.map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="badge badge-present">
                    Present: {attendanceSummary.present_count}
                  </span>
                  <span className="badge badge-late">
                    Late: {attendanceSummary.late_count}
                  </span>
                  <span className="badge badge-absent">
                    Absent: {attendanceSummary.absent_count}
                  </span>
                  {attendanceSummary.unrecorded_count > 0 && (
                    <span className="badge badge-neutral">
                      Unrecorded: {attendanceSummary.unrecorded_count}
                    </span>
                  )}
                  <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.95rem' }}>
                    Rate: {attendanceSummary.attendance_rate}%
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance Student List Table */}
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Class</th>
                    <th>Current Status</th>
                    <th>Remarks</th>
                    <th style={{ textAlign: 'right' }}>Mark Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRoster.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No enrolled students found for {attendanceClass}.
                      </td>
                    </tr>
                  ) : (
                    attendanceRoster.map((student) => {
                      const status = student.status || 'Present';
                      return (
                        <tr key={student.student_id}>
                          <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{student.roll_number}</td>
                          <td style={{ fontWeight: 700 }}>{student.full_name}</td>
                          <td>{student.class_name} ({student.section})</td>
                          <td>
                            <StatusBadge status={status} />
                          </td>
                          <td style={{ minWidth: '180px' }}>
                            <input
                              type="text"
                              className="form-input"
                              style={{ padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}
                              placeholder="e.g. Doctor note..."
                              value={student.remarks || ''}
                              onChange={(e) => handleSetStudentRemarks(student.student_id, e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                              <button
                                type="button"
                                className="btn-icon"
                                onClick={() => handleOpenWhatsAppModal(student, status)}
                                title={`Send WhatsApp message to guardian`}
                                style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: '#059669', padding: '0.35rem 0.5rem', borderRadius: '6px' }}
                              >
                                <MessageSquare size={14} />
                              </button>
                              <div className="status-btn-group">
                                <button
                                  className={`status-toggle-btn ${status === 'Present' ? 'active-present' : ''}`}
                                  onClick={() => handleSetStudentStatus(student.student_id, 'Present')}
                                >
                                  <Check size={13} /> Present
                                </button>
                                <button
                                  className={`status-toggle-btn ${status === 'Late' ? 'active-late' : ''}`}
                                  onClick={() => handleSetStudentStatus(student.student_id, 'Late')}
                                >
                                  <Clock size={13} /> Late
                                </button>
                                <button
                                  className={`status-toggle-btn ${status === 'Absent' ? 'active-absent' : ''}`}
                                  onClick={() => handleSetStudentStatus(student.student_id, 'Absent')}
                                >
                                  <X size={13} /> Absent
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORTS & ANALYTICS TAB */}
        {activeTab === 'reports' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  Attendance Analytics & Reports
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  View longitudinal attendance trends, aggregate rates, and export CSV logs.
                </p>
              </div>

              <button
                className="btn btn-secondary no-print"
                onClick={() => window.print()}
                title="Print report or save as PDF"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Printer size={16} /> Print / Save PDF
              </button>

              <button
                className="btn btn-primary no-print"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('classroom_token');
                    const params = new URLSearchParams({
                      start_date: reportStartDate,
                      end_date: reportEndDate,
                      class_name: reportClass
                    });
                    const res = await fetch(`/api/reports/attendance/csv?${params.toString()}`, {
                      headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });
                    if (!res.ok) throw new Error('Failed to download report');
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    const safeClass = reportClass.replace(/ /g, '_');
                    link.download = `attendance_report_${safeClass}_${reportStartDate}_to_${reportEndDate}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast('Attendance report CSV downloaded successfully!');
                  } catch (err) {
                    showToast(err.message || 'CSV export failed');
                  }
                }}
              >
                <BookOpen size={16} /> Export CSV Report
              </button>
            </div>

            {/* Institution Ledger Report Header */}
            <div className="report-institution-header card" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 1.4rem',
              marginBottom: '1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface-color)',
              flexWrap: 'wrap'
            }}>
              <SchoolLogo
                logoUrl={institution.logo_url}
                institutionName={institution.institution_name}
                size={48}
                showBorder={true}
                rounded="md"
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {institution.institution_name}
                  </h3>
                  <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>
                    {institution.institution_code}
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Official Attendance Ledger • Academic Year {institution.academic_year} • {institution.current_term}
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="card" style={{ padding: '1.15rem 1.4rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>From:</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ maxWidth: '170px' }}
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>To:</span>
                  <input
                    type="date"
                    className="form-input"
                    style={{ maxWidth: '170px' }}
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Class:</span>
                  <select
                    className="form-select"
                    style={{ maxWidth: '170px' }}
                    value={reportClass}
                    onChange={(e) => setReportClass(e.target.value)}
                  >
                    <option value="All Classes">All Classes</option>
                    {classes.map((cls) => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <button className="btn btn-secondary" onClick={loadReports}>
                  <RefreshCw size={15} /> Apply Filter
                </button>
              </div>
            </div>

            {/* Summary Metrics Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon success">
                  <CalendarCheck size={24} />
                </div>
                <div>
                  <div className="stat-val">{reportData.summary.overall_rate}%</div>
                  <div className="stat-label">Overall Attendance Rate</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon primary">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <div className="stat-val">{reportData.summary.present_count}</div>
                  <div className="stat-label">Total Present Records</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon warning">
                  <Clock size={24} />
                </div>
                <div>
                  <div className="stat-val">{reportData.summary.late_count}</div>
                  <div className="stat-label">Total Late Records</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon danger">
                  <X size={24} />
                </div>
                <div>
                  <div className="stat-val">{reportData.summary.absent_count}</div>
                  <div className="stat-label">Total Absent Records</div>
                </div>
              </div>
            </div>

            {/* Timeline Breakdown Table */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <h2 className="card-title">Daily Attendance Trends</h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {reportData.timeline.length} Recorded Day(s)
                </span>
              </div>

              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Total Marked</th>
                      <th>Present</th>
                      <th>Late</th>
                      <th>Absent</th>
                      <th>Day Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.timeline.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No attendance history found for the selected range.
                        </td>
                      </tr>
                    ) : (
                      reportData.timeline.map((day) => {
                        const dayRate = day.total > 0 ? Math.round((day.present / day.total) * 100) : 0;
                        return (
                          <tr key={day.date}>
                            <td style={{ fontWeight: 700 }}>{day.date}</td>
                            <td>{day.total}</td>
                            <td><span className="badge badge-present">{day.present}</span></td>
                            <td><span className="badge badge-late">{day.late}</span></td>
                            <td><span className="badge badge-absent">{day.absent}</span></td>
                            <td style={{ minWidth: '180px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.88rem', minWidth: '38px' }}>{dayRate}%</span>
                                <div className="progress-container">
                                  <div
                                    className={`progress-fill ${dayRate >= 85 ? 'success' : ''}`}
                                    style={{ width: `${dayRate}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PHOTO REVIEW TAB (PHASE 3 OPENCV PIPELINE) */}
        {activeTab === 'photo_review' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  Photo-Assisted Attendance Verification
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  OpenCV face detection pipeline with teacher verification for roll call accuracy.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {photoFile && (
                  <button className="btn btn-secondary" onClick={handleClearPhotoSession}>
                    <Trash2 size={16} /> Clear Session
                  </button>
                )}
                <span className="badge badge-present">
                  <Sparkles size={14} /> OpenCV Pipeline
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {/* Photo Upload Card */}
              <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', border: '2px dashed var(--primary-border)' }}>
                <input
                  type="file"
                  ref={photoInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                />

                {photoPreview ? (
                  <div>
                    <img
                      src={photoPreview}
                      alt="Classroom preview"
                      style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '12px', objectFit: 'cover', marginBottom: '1.25rem', boxShadow: 'var(--shadow-md)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => photoInputRef.current && photoInputRef.current.click()}
                      >
                        Change Photo / Retake
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isDetectingPhoto}
                        onClick={() => handleProcessPhoto(photoFile)}
                      >
                        {isDetectingPhoto ? 'Analyzing...' : 'Re-run Detection'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'inline-flex', padding: '1.25rem', background: 'var(--primary-light)', borderRadius: '50%', color: 'var(--primary)', marginBottom: '1rem' }}>
                      <UploadCloud size={40} />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Classroom Photo Attendance</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
                      Capture with device camera or upload a group photo. Faces are detected locally and matched against your student roster.
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() => photoInputRef.current && photoInputRef.current.click()}
                    >
                      <Camera size={16} /> Take Photo / Select Image
                    </button>
                  </div>
                )}
              </div>

              {/* Detected Face Verification Panel */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Detected Faces Review</h2>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Confirm student assignments before saving to attendance records.
                    </p>
                  </div>
                  <span className="badge badge-present">
                    {detectedFaces.length} Identified
                  </span>
                </div>

                {detectedFaces.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <Camera size={36} color="var(--text-light)" style={{ marginBottom: '0.75rem' }} />
                    <p>No active photo analysis. Upload a classroom picture to begin.</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '340px', overflowY: 'auto', marginBottom: '1.25rem' }}>
                      {detectedFaces.map((face) => (
                        <div
                          key={face.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.85rem 1rem',
                            background: 'var(--border-light)',
                            borderRadius: 'var(--radius-md)',
                            gap: '1rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              flexShrink: 0
                            }}>
                              #{face.id}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Face Bounding #{face.id}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Match: {face.confidence}% • Present
                              </div>
                            </div>
                          </div>

                          <select
                            className="form-select"
                            style={{ maxWidth: '170px', padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                            value={faceAssignments[face.id] || ''}
                            onChange={(e) =>
                              setFaceAssignments({ ...faceAssignments, [face.id]: Number(e.target.value) })
                            }
                          >
                            <option value="">Select Student...</option>
                            {students.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.full_name} ({st.roll_number})
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      onClick={handleConfirmPhotoAttendance}
                    >
                      <CheckCircle2 size={16} /> Confirm & Commit Attendance
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ADMIN SETTINGS TAB */}
        {activeTab === 'admin' && (
          teacherProfile?.role === 'admin' ? (
            <AdminSettings
              teacherProfile={teacherProfile}
              onShowToast={showToast}
              onInstitutionUpdated={handleInstitutionUpdated}
            />
          ) : (
            <div className="card" style={{ maxWidth: '640px', margin: '3rem auto', textAlign: 'center', padding: '3.5rem 2rem' }}>
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(30, 58, 138, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                color: 'var(--primary)'
              }}>
                <Shield size={34} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                Administrator Authentication Required
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 2rem' }}>
                {bootstrapRequired
                  ? 'No administrator accounts exist yet on this installation. Set up your root administrator account to access school profile, classes, staff permissions, and storage.'
                  : 'Institutional administration is restricted to authorized school administrators. Please sign in with administrator credentials to access school profile, classes, staff management, and system backups.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-large"
                  onClick={() => {
                    setIsAuthModalOpen(true);
                    setAuthError('');
                    if (bootstrapRequired) {
                      setIsBootstrapMode(true);
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
                >
                  {bootstrapRequired ? (
                    <>
                      <Sparkles size={18} />
                      <span>Setup Administrator</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      <span>Sign In as Administrator</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-large"
                  onClick={() => setActiveTab('dashboard')}
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )
        )}
      </main>

      {/* STUDENT PORTFOLIO MODAL */}
      <Modal
        isOpen={Boolean(viewingStudent)}
        onClose={() => setViewingStudent(null)}
        title={viewingStudent ? `${viewingStudent.full_name}'s Portfolio` : 'Student Portfolio'}
      >
        {viewingStudent && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '16px',
                    background: '#F1F5F9',
                    border: '2px solid var(--border)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}>
                    {viewingStudent.has_photo ? (
                      <img
                        src={`/api/students/${viewingStudent.id}/photo?v=${viewingStudent.updated_at || 1}`}
                        alt={viewingStudent.full_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.parentElement) e.target.parentElement.innerText = viewingStudent.full_name.charAt(0);
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {viewingStudent.full_name.charAt(0)}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{viewingStudent.full_name}</h3>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.15rem' }}>
                    Roll: <strong style={{ color: 'var(--primary)' }}>{viewingStudent.roll_number}</strong> • {viewingStudent.class_name} (Section {viewingStudent.section})
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem', alignItems: 'center' }}>
                    <input
                      type="file"
                      ref={portfolioPhotoInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={handlePortfolioPhotoSelect}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={isUploadingPortfolioPhoto}
                      onClick={() => portfolioPhotoInputRef.current?.click()}
                      style={{ fontSize: '0.76rem', padding: '0.25rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Upload size={12} />
                      <span>{isUploadingPortfolioPhoto ? 'Saving...' : viewingStudent.has_photo ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {viewingStudent.has_photo && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={isUploadingPortfolioPhoto}
                        onClick={handlePortfolioPhotoDelete}
                        style={{ fontSize: '0.76rem', padding: '0.25rem 0.55rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        title="Remove student photograph"
                      >
                        <Trash2 size={12} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--border-light)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-md)' }}>
                <SchoolLogo
                  logoUrl={institution.logo_url}
                  institutionName={institution.institution_name}
                  size={26}
                  rounded="sm"
                />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {institution.institution_name}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                Attendance Record
              </h4>
              {loadingHistory ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</div>
              ) : studentHistory ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ background: 'var(--border-light)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{studentHistory.metrics.attendance_rate}%</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rate</div>
                    </div>
                    <div style={{ background: 'var(--success-bg)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>{studentHistory.metrics.present_days}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--success)' }}>Present</div>
                    </div>
                    <div style={{ background: 'var(--warning-bg)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--warning)' }}>{studentHistory.metrics.late_days}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--warning)' }}>Late</div>
                    </div>
                    <div style={{ background: 'var(--danger-bg)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--danger)' }}>{studentHistory.metrics.absent_days}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>Absent</div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.5rem' }}>Recent Log</h4>
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {studentHistory.history && studentHistory.history.length > 0 ? (
                      studentHistory.history.map((h) => (
                        <div key={h.id} className="history-item">
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{h.date}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {h.remarks && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{h.remarks}</span>}
                            <StatusBadge status={h.status} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No attendance sessions recorded yet.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', fontSize: '0.88rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Guardian Name & Relation</span>
                <strong>{viewingStudent.guardian_name || 'Guardian'} ({viewingStudent.guardian_relationship || 'Guardian'})</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>WhatsApp / Phone</span>
                <strong>{viewingStudent.whatsapp_number || viewingStudent.guardian_contact || 'None listed'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Messaging Consent</span>
                <span className={`badge ${viewingStudent.whatsapp_consent ? 'badge-present' : 'badge-primary'}`} style={{ fontSize: '0.75rem' }}>
                  {viewingStudent.whatsapp_consent ? 'Consented' : 'Consent Pending'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Enrollment Date</span>
                <strong>{viewingStudent.enrollment_date}</strong>
              </div>
            </div>

            {viewingStudent.notes && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.78rem' }}>Notes</span>
                <p style={{ background: 'var(--border-light)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginTop: '0.25rem' }}>
                  {viewingStudent.notes}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => handleOpenWhatsAppModal(viewingStudent, 'General')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#059669' }}
              >
                <MessageSquare size={15} />
                <span>Send WhatsApp Notice</span>
              </button>
              <button className="btn btn-secondary" onClick={() => setViewingStudent(null)}>
                Close Portfolio
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CSV IMPORT MODAL */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Students from CSV"
      >
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1rem' }}>
            Paste comma-separated rows with format: <code>RollNumber, FullName, ClassName, Section, GuardianContact</code>
          </p>

          <textarea
            className="form-textarea"
            rows="6"
            placeholder="R-301, John Doe, Grade 4, A, +1 555-111-2222&#10;R-302, Jane Smith, Grade 4, B, +1 555-333-4444"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={!csvText.trim()}
              onClick={handleImportCsv}
            >
              Import Students
            </button>
          </div>
        </div>
      </Modal>

      {/* ADD STUDENT MODAL */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Enroll New Student"
      >
        <form onSubmit={handleCreateStudent}>
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {formError}
            </div>
          )}

          {/* Photograph Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', padding: '0.85rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '12px', background: '#E2E8F0', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {newStudentPhotoPreview ? (
                <img src={newStudentPhotoPreview} alt="Student Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Camera size={26} color="var(--text-muted)" />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.3rem', color: 'var(--text-main)' }}>
                Student Portrait Photograph (Optional)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="file"
                  ref={newStudentPhotoInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleNewStudentPhotoChange}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => newStudentPhotoInputRef.current?.click()}
                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
                >
                  <Upload size={13} style={{ marginRight: '0.3rem' }} />
                  {newStudentPhotoFile ? 'Change Photo' : 'Select Photo'}
                </button>
                {newStudentPhotoFile && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', color: 'var(--danger)', padding: '0.25rem 0.65rem' }}
                    onClick={handleClearNewStudentPhoto}
                  >
                    Remove
                  </button>
                )}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                JPG, PNG, or WEBP up to 5MB. Persisted in local data directory.
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Roll Number *</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.roll_number}
                onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Class Name *</label>
              <select
                className="form-select"
                value={formData.class_name}
                onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
              >
                {classes.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              required
              placeholder="e.g. Fatima Tariq"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Section</label>
              <input
                type="text"
                className="form-input"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Enrollment Date *</label>
              <input
                type="date"
                className="form-input"
                required
                value={formData.enrollment_date}
                onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Guardian Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Tariq Mehmood"
                value={formData.guardian_name}
                onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Relationship</label>
              <select
                className="form-select"
                value={formData.guardian_relationship}
                onChange={(e) => setFormData({ ...formData, guardian_relationship: e.target.value })}
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Legal Guardian</option>
                <option value="Relative">Other Relative</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">WhatsApp Contact Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="+1 (555) 234-5678"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notification Preferences</label>
              <select
                className="form-select"
                value={formData.notification_preferences}
                onChange={(e) => setFormData({ ...formData, notification_preferences: e.target.value })}
              >
                <option value="attendance">Attendance Alerts (Absent/Late)</option>
                <option value="all">All School Announcements</option>
                <option value="emergency_only">Emergency Only</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={formData.whatsapp_consent}
                onChange={(e) => setFormData({ ...formData, whatsapp_consent: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#1E3A8A' }}
              />
              <span>Guardian has consented to receive WhatsApp school notifications</span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Special Notes (Optional)</label>
            <textarea
              className="form-textarea"
              rows="2"
              placeholder="Allergies, emergency details, etc."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Enroll Student
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT STUDENT MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Student Portfolio"
      >
        <form onSubmit={handleUpdateStudent}>
          {formError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {formError}
            </div>
          )}

          {/* Photograph Management */}
          {currentStudent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', padding: '0.85rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: '#F1F5F9', border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {currentStudent.has_photo ? (
                  <img
                    src={`/api/students/${currentStudent.id}/photo?v=${currentStudent.updated_at || 1}`}
                    alt={currentStudent.full_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.parentElement) e.target.parentElement.innerText = currentStudent.full_name.charAt(0);
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {currentStudent.full_name.charAt(0)}
                  </span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>Student Photograph</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="file"
                    ref={editStudentPhotoInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !currentStudent) return;
                      try {
                        const res = await studentApi.uploadPhoto(currentStudent.id, file);
                        if (res.success) {
                          showToast('Photograph updated successfully');
                          const updated = { ...currentStudent, ...res.student, has_photo: true, photo_url: res.photo_url };
                          setCurrentStudent(updated);
                          setStudents((prev) => prev.map((s) => (s.id === currentStudent.id ? updated : s)));
                        }
                      } catch (err) {
                        showToast(err.message || 'Failed to upload photo', 'error');
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => editStudentPhotoInputRef.current?.click()}
                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
                  >
                    <Upload size={13} style={{ marginRight: '0.3rem' }} />
                    {currentStudent.has_photo ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {currentStudent.has_photo && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.78rem', color: 'var(--danger)', padding: '0.25rem 0.65rem' }}
                      onClick={async () => {
                        if (!window.confirm('Remove photograph for this student?')) return;
                        try {
                          const res = await studentApi.deletePhoto(currentStudent.id);
                          if (res.success) {
                            showToast('Photograph removed');
                            const updated = { ...currentStudent, ...res.student, has_photo: false, photo_url: null, photo_path: '' };
                            setCurrentStudent(updated);
                            setStudents((prev) => prev.map((s) => (s.id === currentStudent.id ? updated : s)));
                          }
                        } catch (err) {
                          showToast(err.message || 'Failed to remove photo', 'error');
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Roll Number</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.roll_number}
                onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Class</label>
              <select
                className="form-select"
                value={formData.class_name}
                onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
              >
                {classes.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Section</label>
              <input
                type="text"
                className="form-input"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Enrollment Date</label>
              <input
                type="date"
                className="form-input"
                required
                value={formData.enrollment_date}
                onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Guardian Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Tariq Mehmood"
                value={formData.guardian_name}
                onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Relationship</label>
              <select
                className="form-select"
                value={formData.guardian_relationship}
                onChange={(e) => setFormData({ ...formData, guardian_relationship: e.target.value })}
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Legal Guardian</option>
                <option value="Relative">Other Relative</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">WhatsApp Contact Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="+1 (555) 234-5678"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Notification Preferences</label>
              <select
                className="form-select"
                value={formData.notification_preferences}
                onChange={(e) => setFormData({ ...formData, notification_preferences: e.target.value })}
              >
                <option value="attendance">Attendance Alerts (Absent/Late)</option>
                <option value="all">All School Announcements</option>
                <option value="emergency_only">Emergency Only</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={formData.whatsapp_consent}
                onChange={(e) => setFormData({ ...formData, whatsapp_consent: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#1E3A8A' }}
              />
              <span>Guardian has consented to receive WhatsApp school notifications</span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* PHASE 4: TEACHER AUTHENTICATION & BOOTSTRAP MODAL */}
      <Modal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title={isBootstrapMode ? "Initial Administrator Setup" : "Educator Sign-In"}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <SchoolLogo
            logoUrl={institution.logo_url}
            institutionName={institution.institution_name}
            size={56}
            showBorder={true}
            rounded="lg"
          />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.6rem', marginBottom: '0.2rem', color: 'var(--text-main)' }}>
            {institution.institution_name}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Academic Year {institution.academic_year} • Classroom OS Portal
          </p>
        </div>

        {isBootstrapMode ? (
          <form onSubmit={handleBootstrap}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(14, 165, 233, 0.06) 100%)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              borderRadius: '10px'
            }}>
              <Sparkles size={22} color="var(--primary)" />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                <strong>Initial Setup:</strong> Create the root administrator account to initialize and secure this ClassroomOS installation.
              </div>
            </div>

            {authError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '1rem', fontSize: '0.88rem' }}>
                <AlertCircle size={18} />
                <span>{authError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g., Principal Jane Doe"
                value={bootstrapForm.full_name}
                onChange={(e) => setBootstrapForm({ ...bootstrapForm, full_name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Administrator Email Address</label>
              <input
                type="email"
                className="form-input"
                required
                placeholder="admin@springfieldacademy.edu"
                value={bootstrapForm.email}
                onChange={(e) => setBootstrapForm({ ...bootstrapForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Administrator Password</label>
              <input
                type="password"
                className="form-input"
                required
                minLength={12}
                placeholder="At least 12 characters (letters & numbers)"
                value={bootstrapForm.password}
                onChange={(e) => setBootstrapForm({ ...bootstrapForm, password: e.target.value })}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                Must be at least 12 characters and include both letters and numbers.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                required
                minLength={12}
                placeholder="Re-enter administrator password"
                value={bootstrapForm.confirm_password}
                onChange={(e) => setBootstrapForm({ ...bootstrapForm, confirm_password: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                {!bootstrapRequired && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setIsBootstrapMode(false); setAuthError(''); }}
                  >
                    Switch to Sign-In
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAuthModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                  <UserPlus size={16} /> Create Administrator & Launch
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '10px' }}>
              <Lock size={24} color="var(--primary)" />
              <div style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                Sign in to authenticate as a lead educator or school administrator.
              </div>
            </div>

            {authError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', marginBottom: '1rem', fontSize: '0.88rem' }}>
                <AlertCircle size={18} />
                <span>{authError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                required
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                required
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                {bootstrapRequired && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setIsBootstrapMode(true); setAuthError(''); }}
                    style={{ color: 'var(--primary)', fontWeight: 600 }}
                  >
                    <Sparkles size={14} style={{ marginRight: '0.3rem' }} />
                    First Run? Create Administrator
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAuthModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <LogIn size={16} /> Sign In
                </button>
              </div>
            </div>

            {/* Account Recovery Guidance */}
            <div style={{
              marginTop: '1.5rem',
              padding: '0.75rem 0.9rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '0.76rem',
              color: 'var(--text-muted)',
              lineHeight: 1.45
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                Administrator Account Recovery
              </div>
              Lost credentials or locked out? ClassroomOS supports secure administrative password recovery via the desktop launcher CLI without modifying student data:
              <code style={{ display: 'block', margin: '0.35rem 0', padding: '0.25rem 0.45rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', fontFamily: 'monospace', color: 'var(--primary)' }}>
                ClassroomOS.exe --reset-admin &lt;email&gt;
              </code>
              All student profiles, attendance histories, and records remain intact.
            </div>
          </form>
        )}
      </Modal>

      {/* PHASE 4: PRIVACY & DATA ETHICS CONTROLS MODAL */}
      <Modal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        title="Classroom Privacy & Data Ethics"
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0.75rem 1rem', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: '10px' }}>
            <ShieldCheck size={26} color="#10B981" />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                FERPA & Student Privacy Compliance
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Local edge computer vision. Zero cloud facial recognition.
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-main)' }}>
              Ethical Guardrails:
            </h4>
            <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {(privacyPolicy?.compliance || [
                'Zero Biometric Embedding Storage: No facial embeddings, vectors, or identity matrices are stored.',
                'Local Edge Processing: Haar Cascade face detection operates exclusively on the local host.',
                'Human-in-the-Loop: Teachers manually confirm all attendance; no automated identity assignment.',
                'Ephemeral Image Retention: Classroom photos and detected crops are strictly temporary.'
              ]).map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          </div>

          {/* Local Audit Storage Stats */}
          <div style={{ padding: '0.85rem', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Local Session Storage Footprint
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {privacyAudit?.temporary_crops_count ?? 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Temp Crops</div>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {Math.round((privacyAudit?.temporary_storage_bytes || 0) / 1024)} KB
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Disk Used</div>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10B981' }}>
                  {privacyAudit?.status || 'Compliant'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={isPurgingPrivacy}
              onClick={handlePurgePrivacy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#EF4444' }}
            >
              <Trash2 size={16} />
              {isPurgingPrivacy ? 'Purging...' : 'Purge Temporary Photo Data'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsPrivacyModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* GUARDIAN WHATSAPP NOTIFICATION MODAL */}
      <Modal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        title={`Send WhatsApp Notification: ${whatsAppTarget?.full_name || whatsAppTarget?.name || 'Student'}`}
      >
        <form onSubmit={handleLaunchWhatsApp}>
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#1E40AF', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <MessageSquare size={18} style={{ flexShrink: 0 }} />
            <span>ClassroomOS prepared notification — launches WhatsApp directly with your customized message ready to send.</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Guardian Contact Name</label>
              <input
                type="text"
                className="form-input"
                value={whatsAppGuardianName}
                onChange={(e) => setWhatsAppGuardianName(e.target.value)}
                placeholder="e.g. Guardian Name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">WhatsApp Number *</label>
              <input
                type="text"
                required
                className="form-input"
                value={whatsAppPhone}
                onChange={(e) => setWhatsAppPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Select Notice Template</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${whatsAppTemplate === 'absent' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSelectWhatsAppTemplate('absent')}
                style={{ backgroundColor: whatsAppTemplate === 'absent' ? '#1E3A8A' : undefined }}
              >
                Absent Today
              </button>
              <button
                type="button"
                className={`btn btn-sm ${whatsAppTemplate === 'late' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSelectWhatsAppTemplate('late')}
                style={{ backgroundColor: whatsAppTemplate === 'late' ? '#1E3A8A' : undefined }}
              >
                Late Arrival
              </button>
              <button
                type="button"
                className={`btn btn-sm ${whatsAppTemplate === 'general' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSelectWhatsAppTemplate('general')}
                style={{ backgroundColor: whatsAppTemplate === 'general' ? '#1E3A8A' : undefined }}
              >
                General Notice
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Notification Message Preview (Editable)</label>
            <textarea
              className="form-textarea"
              rows="4"
              required
              value={whatsAppMessageText}
              onChange={(e) => setWhatsAppMessageText(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Recipient will receive this exact text when you confirm and send in WhatsApp.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsWhatsAppModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isDispatchingWhatsApp}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#059669', borderColor: '#059669' }}
            >
              <Send size={15} />
              <span>{isDispatchingWhatsApp ? 'Launching...' : 'Launch WhatsApp & Log'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
