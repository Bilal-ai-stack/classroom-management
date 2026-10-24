import React, { useState, useEffect } from 'react';
import Navbar from './shared/Navbar';
import Modal from './shared/Modal';
import StatusBadge from './shared/StatusBadge';
import { studentApi } from './shared/api';
import {
  Users,
  Search,
  Plus,
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
  BookOpen
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
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null);
  const [formData, setFormData] = useState(() => ({
    roll_number: '',
    full_name: '',
    class_name: 'Grade 1',
    section: 'A',
    guardian_contact: '',
    enrollment_date: getTodayDate(),
    notes: ''
  }));
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadDashboardStats = React.useCallback(async () => {
    try {
      const res = await studentApi.getStats();
      if (res && res.stats) setStats(res.stats);
    } catch {
      // Fallback preview data when running standalone
      setStats({
        total_students: 12,
        today_present: 10,
        today_absent: 1,
        today_late: 1,
        attendance_rate: 92,
        recent_students: [
          { id: 1, roll_number: 'STU-101', full_name: 'Amina Khan', class_name: 'Grade 1', section: 'A', is_active: true },
          { id: 2, roll_number: 'STU-102', full_name: 'Bilal Farooq', class_name: 'Grade 1', section: 'A', is_active: true },
          { id: 3, roll_number: 'STU-103', full_name: 'Zainab Fatima', class_name: 'Grade 2', section: 'B', is_active: true }
        ]
      });
    }
  }, []);

  const loadClasses = React.useCallback(async () => {
    try {
      const res = await studentApi.getClasses();
      if (res && res.classes) setClasses(res.classes);
    } catch {
      setClasses(['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']);
    }
  }, []);

  const loadStudents = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await studentApi.getStudents(searchQuery, selectedClass, includeArchived);
      if (res && res.students) {
        setStudents(res.students);
      }
    } catch {
      // Fallback sample list
      setStudents([
        { id: 1, roll_number: 'STU-101', full_name: 'Amina Khan', class_name: 'Grade 1', section: 'A', guardian_contact: '+92 300 1234567', enrollment_date: '2026-01-10', is_active: true },
        { id: 2, roll_number: 'STU-102', full_name: 'Bilal Farooq', class_name: 'Grade 1', section: 'A', guardian_contact: '+92 321 7654321', enrollment_date: '2026-01-12', is_active: true },
        { id: 3, roll_number: 'STU-103', full_name: 'Zainab Fatima', class_name: 'Grade 2', section: 'B', guardian_contact: '+92 333 9876543', enrollment_date: '2026-01-15', is_active: true },
        { id: 4, roll_number: 'STU-104', full_name: 'Daniyal Ahmed', class_name: 'Grade 2', section: 'A', guardian_contact: '+92 345 1122334', enrollment_date: '2026-01-18', is_active: true }
      ]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedClass, includeArchived]);

  // Load dashboard & classes on mount
  useEffect(() => {
    loadDashboardStats();
    loadClasses();
  }, [loadDashboardStats, loadClasses]);

  // Reload students on search or filter change
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleOpenAddModal = () => {
    setFormData({
      roll_number: `STU-${Math.floor(100 + Math.random() * 900)}`,
      full_name: '',
      class_name: classes[0] || 'Grade 1',
      section: 'A',
      guardian_contact: '',
      enrollment_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      await studentApi.createStudent(formData);
      setIsAddModalOpen(false);
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
      enrollment_date: student.enrollment_date,
      notes: student.notes || ''
    });
    setFormError('');
    setIsEditModalOpen(true);
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

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1.5rem',
          zIndex: 1000,
          background: 'var(--text-main)',
          color: '#FFFFFF',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} color="#22C55E" />
          {toastMessage}
        </div>
      )}

      <main className="main-content">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>Classroom Overview</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Real-time student metrics, attendance rate, and portfolio status.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={() => { loadDashboardStats(); showToast('Metrics refreshed'); }}>
                  <RefreshCw size={16} /> Refresh
                </button>
                <button className="btn btn-primary" onClick={handleOpenAddModal}>
                  <Plus size={16} /> Enroll Student
                </button>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon primary">
                  <Users size={24} />
                </div>
                <div>
                  <div className="stat-val">{stats.total_students}</div>
                  <div className="stat-label">Enrolled Students</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon success">
                  <CalendarCheck size={24} />
                </div>
                <div>
                  <div className="stat-val">{stats.attendance_rate}%</div>
                  <div className="stat-label">Attendance Rate</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon warning">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div className="stat-val">{classes.length || 5}</div>
                  <div className="stat-label">Active Classes</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon danger">
                  <Camera size={24} />
                </div>
                <div>
                  <div className="stat-val">Enabled</div>
                  <div className="stat-label">Photo Attendance MVP</div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Students */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Quick Actions</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '0.85rem 1rem' }}
                    onClick={() => setActiveTab('students')}
                  >
                    <Users size={18} color="var(--primary)" />
                    <span>View All Student Portfolios</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '0.85rem 1rem' }}
                    onClick={() => setActiveTab('attendance')}
                  >
                    <CalendarCheck size={18} color="var(--success)" />
                    <span>Mark Daily Attendance (Phase 2)</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ justifyContent: 'flex-start', padding: '0.85rem 1rem' }}
                    onClick={() => setActiveTab('photo_review')}
                  >
                    <Camera size={18} color="var(--warning)" />
                    <span>Photo-Assisted Review (Phase 3)</span>
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Recently Registered Students</h2>
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
                          padding: '0.75rem',
                          background: 'var(--border-light)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.full_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>Student Directory & Portfolios</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Manage enrolled student profiles, classes, and contact records.</p>
              </div>
              <button className="btn btn-primary" onClick={handleOpenAddModal}>
                <Plus size={16} /> Add Student
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
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

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(e) => setIncludeArchived(e.target.checked)}
                    />
                    Include Archived Students
                  </label>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
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
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        Loading student records...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                          <AlertCircle size={28} color="var(--text-light)" />
                          <span>No students found matching your criteria.</span>
                          <button className="btn btn-secondary btn-sm" onClick={handleOpenAddModal}>
                            Enroll a new student
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id}>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {student.roll_number}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{student.full_name}</div>
                          {student.notes && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{student.notes}</div>
                          )}
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{student.class_name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.35rem' }}>
                            (Sec {student.section})
                          </span>
                        </td>
                        <td>
                          {student.guardian_contact ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                              <Phone size={13} color="var(--text-muted)" />
                              {student.guardian_contact}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>None</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Edit Student"
                              onClick={() => handleOpenEditModal(student)}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className={`btn btn-sm ${student.is_active ? 'btn-outline-danger' : 'btn-secondary'}`}
                              title={student.is_active ? 'Archive Student' : 'Restore Student'}
                              onClick={() => handleToggleArchive(student)}
                            >
                              <Archive size={13} />
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

        {/* ATTENDANCE TAB (PHASE 2 PREVIEW) */}
        {activeTab === 'attendance' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Daily Attendance Roster</h1>
                <p style={{ color: 'var(--text-muted)' }}>Mark daily presence with one-click toggles and instant synchronization.</p>
              </div>
              <span className="badge badge-late">Phase 2 In Development</span>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', background: 'var(--primary-light)', borderRadius: '50%', color: 'var(--primary)', marginBottom: '1rem' }}>
                <CalendarCheck size={40} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>Daily Attendance Module</h2>
              <p style={{ color: 'var(--text-muted)', maxWidth: '540px', margin: '0 auto 1.5rem' }}>
                The attendance data schema with unique <code>(student_id, date)</code> composite keys and bulk REST endpoints
                is defined in the Phase 2 milestone roadmap.
              </p>
              <button className="btn btn-primary" onClick={() => setActiveTab('students')}>
                Back to Student Directory
              </button>
            </div>
          </div>
        )}

        {/* PHOTO REVIEW TAB (PHASE 3 PREVIEW) */}
        {activeTab === 'photo_review' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Photo-Assisted Review</h1>
                <p style={{ color: 'var(--text-muted)' }}>Local non-biometric Haar-cascade face detector for teacher confirmation.</p>
              </div>
              <span className="badge badge-late">Phase 3 Experimental</span>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', background: 'var(--warning-bg)', borderRadius: '50%', color: 'var(--warning)', marginBottom: '1rem' }}>
                <Camera size={40} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>Privacy-First Face Verification</h2>
              <p style={{ color: 'var(--text-muted)', maxWidth: '560px', margin: '0 auto 1.5rem' }}>
                Extracts bounding crops locally without storing biometrics or face embeddings.
                The teacher reviews each crop against enrolled students before saving.
              </p>
              <button className="btn btn-secondary" onClick={() => setActiveTab('students')}>
                Manage Student Roster
              </button>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === 'reports' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Attendance & Portfolio Reports</h1>
                <p style={{ color: 'var(--text-muted)' }}>Export records and view monthly attendance trends.</p>
              </div>
            </div>

            <div className="card" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Export Attendance Summary</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Download comprehensive student roster and attendance history as CSV or PDF report.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const csvContent = "data:text/csv;charset=utf-8," +
                    "Roll Number,Name,Class,Section,Guardian Contact,Status\n" +
                    students.map(s => `"${s.roll_number}","${s.full_name}","${s.class_name}","${s.section}","${s.guardian_contact || ''}","${s.is_active ? 'Active' : 'Archived'}"`).join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `student_roster_${new Date().toISOString().slice(0, 10)}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  showToast('Student CSV export downloaded successfully!');
                }}
              >
                <BookOpen size={16} /> Export Student Roster (CSV)
              </button>
            </div>
          </div>
        )}
      </main>

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

          <div className="form-group">
            <label className="form-label">Guardian Contact</label>
            <input
              type="text"
              className="form-input"
              placeholder="+92 300 0000000"
              value={formData.guardian_contact}
              onChange={(e) => setFormData({ ...formData, guardian_contact: e.target.value })}
            />
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

          <div className="form-group">
            <label className="form-label">Guardian Contact</label>
            <input
              type="text"
              className="form-input"
              value={formData.guardian_contact}
              onChange={(e) => setFormData({ ...formData, guardian_contact: e.target.value })}
            />
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
    </div>
  );
}
