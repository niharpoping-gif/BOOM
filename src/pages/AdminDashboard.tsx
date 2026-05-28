import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { 
  LayoutDashboard, 
  FileUp, 
  History as HistoryIcon, 
  Settings, 
  LogOut, 
  ScanSearch,
  ShieldCheck, 
  Bell,
  FileText,
  CheckCircle,
  Clock,
  Users,
  Upload,
  Sparkles,
  Download,
  Trash2,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';

export default function AdminDashboard() {
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  const fetchPasses = async () => {
    try {
      const resp = await fetch("/api/passes");
      if (!resp.ok) throw new Error("Failed to load passes");
      const list = await resp.json();
      setPasses(list);
      localStorage.setItem('cgm_passes_cache', JSON.stringify(list));
    } catch (error) {
      console.error("Error fetching passes from backend:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Load cached passes first
    try {
      const cached = localStorage.getItem('cgm_passes_cache');
      if (cached) {
        setPasses(JSON.parse(cached));
        setLoading(false);
      }
    } catch (e) {
      console.warn("Failed to load cached passes:", e);
    }

    fetchPasses();
    const interval = setInterval(fetchPasses, 7000); // refresh every 7 seconds
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const resp = await fetch(`/api/passes/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      if (!resp.ok) throw new Error("Delete failed");
      setShowDeleteConfirm(null);
      fetchPasses();
    } catch (err) {
      console.error("Error deleting pass:", err);
      alert("Failed to delete pass from system.");
    }
  };

  const handleDownload = async (pass: any) => {
    try {
      const sanitizedId = pass.id || pass.dcPassNo.replace(/\//g, '_');
      const downloadUrl = `/api/passes/${encodeURIComponent(sanitizedId)}/file`;
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Pass-${pass.dcPassNo.replace(/\//g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Download error:", err);
      alert("Download error: " + (err.message || err));
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin', active: location.pathname === '/admin' },
    { icon: FileUp, label: 'AI Uploads', path: '/admin/upload', active: location.pathname === '/admin/upload' },
    { icon: HistoryIcon, label: 'History', path: '/admin' },
    { icon: Users, label: 'Users', path: '/admin' },
    { icon: Settings, label: 'Settings', path: '/admin' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        .admin-body {
          font-family: 'Inter', sans-serif;
          background: #f5f5f7;
          color: #111827;
        }

        .dashboard-app {
          display: flex;
          min-height: 100vh;
          gap: 12px;
          padding: 12px;
        }

        .dashboard-sidebar {
          width: 220px;
          background: white;
          border-radius: 20px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04);
          position: sticky;
          top: 12px;
          height: calc(100vh - 24px);
        }

        .brand-section {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }

        .brand-icon-box {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 10px 25px rgba(124,58,237,0.25);
        }
        .brand-icon-box svg { width: 22px !important; height: 22px !important; }

        .brand-section h2 { font-size: 17px; font-weight: 800; line-height: 1.1; }
        .brand-section p { color: #6b7280; font-size: 11px; margin-top: 2px; font-weight: 500; }

        .dashboard-menu { display: flex; flex-direction: column; gap: 4px; }
        .dashboard-menu a, .dashboard-menu button.menu-item {
          text-decoration: none;
          color: #374151;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          font-weight: 600;
          transition: 0.2s;
          font-size: 13px;
        }

        .dashboard-menu a:hover, .dashboard-menu .active-link {
          background: #f3f0ff;
          color: #6d28d9;
        }

        .sidebar-new-upload {
          width: 100%;
          margin: 12px 0;
          border: none;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          padding: 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(124,58,237,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: 0.2s;
        }
        .sidebar-new-upload:hover { transform: translateY(-2px); opacity: 0.95; }

        .sidebar-logout {
          width: 100%;
          border: 1px solid #ececec;
          background: white;
          padding: 12px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #374151;
          transition: 0.2s;
        }
        .sidebar-logout:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }

        .sidebar-powered {
          margin-top: 12px;
          background: #faf7ff;
          border-radius: 14px;
          padding: 12px;
        }
        .sidebar-powered h3 { margin-bottom: 4px; font-size: 13px; font-weight: 700; color: #111827; }
        .sidebar-powered p { color: #6b7280; line-height: 1.5; font-size: 11px; font-weight: 500; }

        .dashboard-main { flex: 1; display: flex; flex-direction: column; gap: 12px; }

        .dashboard-topbar {
          background: white;
          border-radius: 20px;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04);
        }

        .welcome-msg h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; tracking: -0.02em; }
        .welcome-msg p { color: #6b7280; font-size: 13px; font-weight: 500; }

        .profile-section { display: flex; align-items: center; gap: 12px; }
        .notif-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #fafafa;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid #ececec;
          color: #6b7280;
        }
        .notif-btn svg { width: 20px; height: 20px; }

        .admin-avatar {
          width: 40px; height: 40px;
          border-radius: 12px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px;
        }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .stat-card-box {
          background: white;
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04);
        }
        .stat-icon-wrap {
          width: 40px; height: 40px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 12px;
        }
        .stat-icon-wrap svg { width: 20px !important; height: 20px !important; }
        .purple-icon { background: #f3e8ff; color: #7c3aed; }
        .green-icon { background: #dcfce7; color: #16a34a; }
        .blue-icon { background: #dbeafe; color: #2563eb; }
        .orange-icon { background: #ffedd5; color: #ea580c; }

        .stat-card-box h2 { font-size: 22px; margin-bottom: 2px; font-weight: 800; }
        .stat-card-box p { color: #6b7280; font-weight: 600; font-size: 12px; }

        .dashboard-content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }

        .table-container {
          background: white;
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04);
        }
        .table-header-box {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px;
        }
        .table-header-box h2 { font-size: 18px; font-weight: 800; }
        .view-all-link { color: #7c3aed; text-decoration: none; font-weight: 700; font-size: 13px; }

        .custom-table { width: 100%; border-collapse: collapse; }
        .custom-table th {
          text-align: left; padding-bottom: 10px; color: #6b7280;
          font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .custom-table td { padding: 10px 0; border-top: 1px solid #f0f0f0; font-weight: 600; font-size: 13px; }

        .status-badge {
          padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;
        }
        .status-badge svg { width: 12px; height: 12px; }
        .status-completed { background: #dcfce7; color: #16a34a; }
        .status-pending { background: #fef3c7; color: #d97706; }

        .dashboard-right { display: flex; flex-direction: column; gap: 12px; }
        .activity-box, .quick-actions-box {
          background: white; border-radius: 20px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.04);
        }
        .activity-box h2, .quick-actions-box h2 { margin-bottom: 14px; font-size: 16px; font-weight: 800; }

        .activity-row { display: flex; gap: 10px; margin-bottom: 12px; }
        .activity-row:last-child { margin-bottom: 0; }
        .activity-icon-box {
          width: 32px; height: 32px; border-radius: 10px; background: #f3f0ff; color: #7c3aed;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .activity-icon-box svg { width: 16px; height: 16px; }
        .activity-row h4 { margin-bottom: 1px; font-size: 13px; font-weight: 700; }
        .activity-row p { color: #6b7280; font-size: 11px; font-weight: 500; }

        .action-button {
          width: 100%; border: none; margin-bottom: 8px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white; padding: 10px; border-radius: 12px; font-size: 13px; font-weight: 700;
          cursor: pointer; box-shadow: 0 10px 25px rgba(124,58,237,0.18);
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: 0.2s;
        }
        .action-button svg { width: 16px; height: 16px; }
        .action-button:hover { transform: translateY(-2px); opacity: 0.95; }
        .action-button.secondary-btn {
          background: #fafafa; color: #374151; border: 1px solid #ececec; box-shadow: none;
        }
        .action-button.secondary-btn:hover { background: #f3f4f6; transform: none; }

        @media(max-width: 1150px) {
          .dashboard-app { flex-direction: column; gap: 12px; padding: 12px; }
          .dashboard-sidebar { width: 100%; height: auto; position: static; padding: 16px; border-radius: 20px; }
          .brand-section { margin-bottom: 16px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .dashboard-content-grid { grid-template-columns: 1fr; gap: 12px; }
          .dashboard-main { gap: 12px; }
          .dashboard-topbar { padding: 14px 18px; border-radius: 20px; }
          .welcome-msg h1 { font-size: 20px; }
          .stat-card-box { padding: 14px; border-radius: 16px; }
          .stat-card-box h2 { font-size: 20px; }
          .table-container { padding: 16px; border-radius: 20px; }
          .sidebar-powered { display: none; }
        }

        @media(max-width: 700px) {
          .dashboard-app { gap: 8px; padding: 8px; }
          .dashboard-topbar { flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 8px; padding: 12px 14px; }
          .welcome-msg h1 { font-size: 17px; margin-bottom: 1px; }
          .welcome-msg p { font-size: 11px; }
          .profile-section { display: none; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .stat-card-box { padding: 10px; border-radius: 12px; }
          .stat-icon-wrap { width: 32px; height: 32px; border-radius: 8px; margin-bottom: 8px; }
          .stat-icon-wrap svg { width: 16px !important; height: 16px !important; }
          .stat-card-box h2 { font-size: 18px; margin-bottom: 1px; }
          .stat-card-box p { font-size: 11px; }
          .table-container { padding: 12px; border-radius: 16px; }
          .table-header-box { margin-bottom: 12px; }
          .table-header-box h2 { font-size: 14px; }
          .view-all-link { font-size: 12px; }
          .custom-table th { font-size: 10px; padding-bottom: 6px; }
          .custom-table td { font-size: 12px; padding: 8px 0; }
          .status-badge { padding: 2px 6px; font-size: 9px; border-radius: 4px; }
          .activity-box, .quick-actions-box { padding: 14px; border-radius: 16px; }
          .activity-box h2, .quick-actions-box h2 { font-size: 14px; margin-bottom: 10px; }
          .brand-section { margin-bottom: 12px; gap: 8px; }
          .brand-icon-box { width: 36px; height: 36px; border-radius: 10px; }
          .brand-icon-box svg { width: 20px !important; height: 20px !important; }
          .brand-section h2 { font-size: 15px; }
          .dashboard-menu a, .dashboard-menu button.menu-item { padding: 8px 12px; font-size: 12px; border-radius: 10px; }
          .sidebar-new-upload { padding: 10px; font-size: 12px; border-radius: 10px; margin: 8px 0; }
          .sidebar-logout { padding: 10px; font-size: 12px; border-radius: 10px; }
          
          /* Compact Action Buttons on Mobile */
          .custom-table td .action-btn-group { gap: 2px; }
          .custom-table td .action-btn-group a, 
          .custom-table td .action-btn-group button { padding: 3px; border-radius: 4px; }
          .custom-table td .action-btn-group svg { width: 13px !important; height: 13px !important; }
        }
      `}</style>

      <div className="admin-body">
        <div className="dashboard-app">
          {/* SIDEBAR */}
          <aside className="dashboard-sidebar">
            <div>
              <div className="brand-section">
                <div className="brand-icon-box">
                  <ScanSearch size={32} />
                </div>
                <div>
                  <h2>CGM<br/>Intelligence</h2>
                  <p>AI Upload System</p>
                </div>
              </div>

              <nav className="dashboard-menu">
                {menuItems.map((item, idx) => (
                  <Link 
                    key={idx} 
                    to={item.path} 
                    className={item.active ? 'active-link' : ''}
                  >
                    <item.icon size={20} />
                    {item.label}
                  </Link>
                ))}
                
                <button 
                  className="sidebar-new-upload"
                  onClick={() => navigate('/admin/upload')}
                >
                  <Upload size={20} />
                  + New Upload
                </button>
              </nav>
            </div>

            <div>
              <button className="sidebar-logout" onClick={() => signOut(auth)}>
                <LogOut size={20} />
                Sign Out
              </button>

              <div className="sidebar-powered">
                <h3>Powered by CGM AI</h3>
                <p>
                  Secure intelligent extraction system for royalty documents and passes.
                </p>
              </div>
            </div>
          </aside>

          {/* MAIN */}
          <main className="dashboard-main">
            {/* TOPBAR */}
            <div className="dashboard-topbar">
              <div className="welcome-msg">
                <h1>Dashboard Overview 👋</h1>
                <p>Monitor AI uploads, scans and extraction activity in real-time.</p>
              </div>

              <div className="profile-section">
                <div className="notif-btn">
                  <Bell size={24} />
                </div>
                <div className="admin-avatar">
                  {auth.currentUser?.email?.substring(0, 2).toUpperCase() || 'AD'}
                </div>
              </div>
            </div>

            {/* STATS */}
            <div className="stats-grid">
              <div className="stat-card-box">
                <div className="stat-icon-wrap purple-icon">
                  <FileText size={28} />
                </div>
                <h2>{passes.length}</h2>
                <p>Total Documents</p>
              </div>

              <div className="stat-card-box">
                <div className="stat-icon-wrap green-icon">
                  <CheckCircle size={28} />
                </div>
                <h2>{passes.filter(p => !!p.dcPassNo).length}</h2>
                <p>AI Processed</p>
              </div>

              <div className="stat-card-box">
                <div className="stat-icon-wrap blue-icon">
                  <Clock size={28} />
                </div>
                <h2>{passes.filter(p => !p.pdfDownloaded).length}</h2>
                <p>Pending Pass</p>
              </div>

              <div className="stat-card-box">
                <div className="stat-icon-wrap orange-icon">
                  <Users size={28} />
                </div>
                <h2>24</h2>
                <p>Admin Users</p>
              </div>
            </div>

            {/* CONTENT GRID */}
            <div className="dashboard-content-grid">
              {/* LEFT: TABLE */}
              <div className="table-container">
                <div className="table-header-box">
                  <h2>Recent Uploads</h2>
                  <Link to="/admin" className="view-all-link">View All</Link>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center h-48 opacity-50">
                    <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
                    <table className="custom-table min-w-[500px]">
                      <thead>
                        <tr>
                          <th>Document / ID</th>
                          <th>Pass No</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {passes.slice(0, 8).map((pass, idx) => (
                          <tr key={`${pass.id}-${idx}`}>
                            <td>
                              <div className="flex flex-col">
                                <span className="truncate max-w-[150px]">{pass.mineralName || 'Mineral Document'}</span>
                                <span className="text-[11px] text-gray-400 font-medium">
                                  {pass.createdAt?.toDate ? pass.createdAt.toDate().toLocaleDateString() : 'Recent'}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <code>{pass.dcPassNo?.substring(0, 10)}...</code>
                                {pass.manualUpload && (
                                  <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">AI</span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge ${pass.pdfDownloaded ? 'status-completed' : 'status-pending'}`}>
                                {pass.pdfDownloaded ? 'Verified' : 'Pending'}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2 action-btn-group">
                                <Link 
                                  to={`/pass/${encodeURIComponent(pass.dcPassNo)}`}
                                  className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                                >
                                  <ExternalLink size={18} />
                                </Link>
                                {pass.pdfDownloaded && (
                                  <button 
                                    onClick={() => handleDownload(pass)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  >
                                    <Download size={18} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => setShowDeleteConfirm(pass.id)}
                                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {passes.length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center py-12 text-gray-500">
                               No documents found. Start by uploading one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* RIGHT: PANEL */}
              <div className="dashboard-right">
                <div className="activity-box">
                  <h2>Recent Activity</h2>
                  
                  <div className="activity-row">
                    <div className="activity-icon-box">
                      <Upload size={18} />
                    </div>
                    <div>
                      <h4>New Document Uploaded</h4>
                      <p>1 mins ago</p>
                    </div>
                  </div>

                  <div className="activity-row">
                    <div className="activity-icon-box" style={{ background: '#ecfdf5', color: '#10b981' }}>
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h4>AI Extraction Completed</h4>
                      <p>12 mins ago</p>
                    </div>
                  </div>

                  <div className="activity-row">
                    <div className="activity-icon-box" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h4>Admin Logged In</h4>
                      <p>45 mins ago</p>
                    </div>
                  </div>
                </div>

                <div className="quick-actions-box">
                  <h2>Quick Actions</h2>
                  <button className="action-button" onClick={() => navigate('/admin/upload')}>
                    <Upload size={18} />
                    + Upload Document
                  </button>
                  <button className="action-button secondary-btn">
                    Generate Report
                  </button>
                  <button className="action-button secondary-btn">
                    Manage Users
                  </button>
                  <button className="action-button secondary-btn">
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* DELETE CONFIRM MODAL */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <div key="delete-modal-backdrop" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" 
                onClick={() => setShowDeleteConfirm(null)} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
                className="relative bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl"
              >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-2xl font-extrabold text-gray-900 text-center mb-2">Delete Document?</h3>
                <p className="text-gray-500 text-center font-medium leading-relaxed mb-8">
                  This action cannot be undone. All extracted data for this pass will be lost.
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => handleDelete(showDeleteConfirm)} 
                    className="w-full bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-colors"
                  >
                    Delete Forever
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(null)} 
                    className="w-full bg-gray-100 text-gray-600 py-4 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
