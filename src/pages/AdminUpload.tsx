import React, { useState, useEffect, ChangeEvent } from 'react';
import { auth } from '../firebase';
import { 
  LayoutDashboard, 
  FileUp, 
  History, 
  Settings, 
  LogOut, 
  ScanSearch, 
  Bell, 
  CloudUpload, 
  FileText, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  BadgeCheck, 
  Timer,
  Upload,
  Users
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';

export default function AdminUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const navigate = useNavigate();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement> | any) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.type === 'application/pdf' || selected.type.startsWith('image/')) {
        setFile(selected);
        setError(null);
        setResult(null);
      } else {
        setError("Please upload a PDF or an Image file.");
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(5);
    setError(null);

    try {
      const mimeType = file.type;
      const chunkSize = 150 * 1024; // 150 KB chunks (extremely safe from proxy body limits and network issues)
      const totalChunks = Math.ceil(file.size / chunkSize);
      const uploadId = "up_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);

      // 1. Upload slices one-by-one to avoid payload size limit issues
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const slice = file.slice(start, end);

        // Convert chunk slice to base64
        const chunkBase64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = (e) => {
            const res = e.target?.result as string;
            if (!res) return reject(new Error("Empty file reader result"));
            const parts = res.split(',');
            if (parts.length < 2) return reject(new Error("Invalid data URL format"));
            resolve(parts[1]);
          };
          r.onerror = () => reject(r.error || new Error("Failed to read file slice"));
          r.readAsDataURL(slice);
        });

        // Retry chunk uploading up to 3 times to withstand transient network hiccups
        let success = false;
        let lastError = "";
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const chunkResp = await fetch("/api/passes/upload-chunk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ uploadId, chunkIndex: i, totalChunks, chunkData: chunkBase64 })
            });

            if (chunkResp.ok) {
              success = true;
              break;
            } else {
              const errJson = await chunkResp.json().catch(() => ({}));
              lastError = errJson.error || `HTTP Status ${chunkResp.status}`;
            }
          } catch (e: any) {
            lastError = e.message || e.toString();
          }

          if (attempt < 3) {
            // Wait with backoff before retry
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }
        }

        if (!success) {
          throw new Error(`Failed uploading segment ${i + 1} of ${totalChunks} after 3 attempts. Error: ${lastError}`);
        }

        // Advance progress from 10% to 65% during chunk uploads
        const uploadProgress = Math.floor(10 + ((i + 1) * 55) / totalChunks);
        setProgress(uploadProgress);
      }

      setProgress(70);

      // 2. OCR and extract details via server-assembled chunk parser
      const extractResp = await fetch("/api/passes/extract-chunked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, mimeType })
      });

      if (!extractResp.ok) {
        const errJson = await extractResp.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed raw text metadata extraction from document.");
      }

      const extractedData = await extractResp.json();
      
      if (!extractedData || !extractedData.dcPassNo) {
        throw new Error("Could not extract DC Pass Number. Please ensure the document is clear.");
      }

      setProgress(85);

      // 3. Save metadata and associate already-assembled file reference on server
      const saveResp = await fetch("/api/passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: extractedData,
          uploadId,
          originalFormat: mimeType
        })
      });

      if (!saveResp.ok) {
        const errJson = await saveResp.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to save verified transit pass record.");
      }

      const savedRecord = await saveResp.json();

      // Save to client-side localStorage cache immediately for progressive enhancement
      try {
        const cached = localStorage.getItem('cgm_passes_cache');
        const listOfPasses = cached ? JSON.parse(cached) : [];
        const filtered = listOfPasses.filter((p: any) => p.id !== savedRecord.id && p.dcPassNo !== extractedData.dcPassNo);
        filtered.unshift(savedRecord);
        localStorage.setItem('cgm_passes_cache', JSON.stringify(filtered));
        localStorage.setItem(`cgm_pass_${savedRecord.id}`, JSON.stringify(savedRecord));
        localStorage.setItem(`cgm_pass_${extractedData.dcPassNo}`, JSON.stringify(savedRecord));
      } catch (e) {
        console.warn("localStorage cache save error:", e);
      }

      setProgress(100);
      setResult(extractedData);
      
      setTimeout(() => {
        navigate('/admin');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process document.");
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileChange({ target: { files } });
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: FileUp, label: 'Upload Pass', path: '/admin/upload', active: true },
    { icon: History, label: 'History', path: '/admin' },
    { icon: Users, label: 'Users', path: '/admin' },
    { icon: Settings, label: 'Settings', path: '/admin' },
  ];

  return (
    <>
      <style>{`
        .upload-page-bg {
          font-family: 'Inter', sans-serif;
          background: #f5f5f7;
          color: #111827;
        }

        .upload-app {
          display: flex;
          min-height: 100vh;
          gap: 12px;
          padding: 12px;
        }

        .sidebar-v2 {
          width: 220px;
          background: white;
          border-radius: 20px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04);
        }

        .brand-v2 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }

        .brand-icon-v2 {
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
        .brand-icon-v2 svg { width: 22px !important; height: 22px !important; }

        .brand-v2 h2 { font-size: 17px; font-weight: 800; line-height: 1.1; }
        .brand-v2 p { color: #6b7280; font-size: 11px; margin-top: 2px; font-weight: 500; }

        .menu-v2 { display: flex; flex-direction: column; gap: 4px; }
        .menu-v2 a {
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

        .menu-v2 a:hover, .menu-v2 .active-v2 {
          background: #f3f0ff;
          color: #6d28d9;
        }

        .logout-v2 {
          width: 100%;
          border: 1px solid #ececec;
          background: white;
          padding: 12px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          color: #374151;
          transition: 0.2s;
          font-size: 13px;
        }
        .logout-v2:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }

        .main-v2 { flex: 1; display: flex; flex-direction: column; gap: 12px; }

        .topbar-v2 {
          background: white;
          border-radius: 20px;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.04);
        }

        .welcome-v2 h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; tracking: -0.02em; }
        .welcome-v2 p { color: #6b7280; font-size: 13px; font-weight: 500; }

        .profile-v2 { display: flex; align-items: center; gap: 12px; }
        .notif-btn-v2 {
          width: 40px; height: 40px; border-radius: 12px; background: #fafafa;
          border: 1px solid #ececec; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #6b7280;
        }
        .notif-btn-v2 svg { width: 20px; height: 20px; }
        .avatar-v2 {
          width: 40px; height: 40px; border-radius: 12px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px;
        }

        .content-grid-v2 { display: grid; grid-template-columns: 1.5fr 1fr; gap: 12px; }

        .upload-card-v2 { background: white; border-radius: 20px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.04); }
        .section-title-v2 { margin-bottom: 16px; }
        .section-title-v2 h2 { font-size: 20px; font-weight: 800; margin-bottom: 6px; }
        .section-title-v2 p { color: #6b7280; line-height: 1.5; font-size: 13px; font-weight: 500; }

        .drop-area-v2 {
          border: 2px dashed #c4b5fd;
          border-radius: 20px;
          background: linear-gradient(to bottom, #faf7ff, #ffffff);
          padding: 36px 16px;
          text-align: center;
          transition: 0.2s;
          cursor: pointer;
        }
        .drop-area-v2.dragging { background: #f3f0ff; border-color: #7c3aed; }

        .upload-icon-box {
          width: 70px; height: 70px; border-radius: 50%; background: #f3f0ff;
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
        }
        .upload-icon-box svg { width: 32px !important; height: 32px !important; }

        .drop-area-v2 h2 { font-size: 20px; font-weight: 800; margin-bottom: 8px; }
        .drop-area-v2 p { color: #6b7280; font-size: 14px; margin-bottom: 16px; font-weight: 500; }

        .browse-btn-v2 {
          border: none;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(124,58,237,0.2);
          transition: 0.2s;
        }
        .browse-btn-v2:hover { transform: translateY(-2px); opacity: 0.95; }

        .formats-v2 { margin-top: 12px; color: #6b7280; font-size: 12px; font-weight: 500; }

        .file-card-v2 {
          margin-top: 16px; border: 1px solid #ececec; border-radius: 16px; padding: 14px;
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
        }

        .file-left-v2 { display: flex; align-items: center; gap: 12px; }
        .pdf-icon-v2 {
          width: 48px; height: 48px; border-radius: 12px; background: #ffe7ec; color: #ef4444;
          font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 14px;
        }

        .file-name-v2 { font-size: 15px; font-weight: 800; margin-bottom: 4px; word-break: break-all; }
        .meta-v2 { color: #6b7280; font-size: 12px; font-weight: 500; }

        .scan-btn-v2 {
          border: none;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          padding: 12px 18px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: 0.2s;
          display: flex; align-items: center; gap: 8px;
          font-size: 13px;
        }
        .scan-btn-v2:hover { transform: translateY(-2px); opacity: 0.95; }
        .scan-btn-v2:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .extraction-loader {
          margin-top: 14px; background: #faf7ff; border-radius: 14px; padding: 14px;
          display: flex; align-items: center; gap: 10px; color: #6d28d9; font-weight: 700;
          font-size: 13px;
        }

        .spin-v2 {
          width: 20px; height: 20px; border-radius: 50%; border: 3px solid #ddd6fe;
          border-top: 3px solid #6d28d9; animation: spin-v2 1s linear infinite;
        }

        @keyframes spin-v2 { to { transform: rotate(360deg); } }

        .side-panel-v2 { display: flex; flex-direction: column; gap: 12px; }
        .side-card-v2 { background: white; border-radius: 20px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.04); }
        .side-card-v2 h3 { font-size: 16px; font-weight: 800; margin-bottom: 14px; }

        .feature-item-v2 { display: flex; gap: 10px; margin-bottom: 14px; }
        .feature-icon-v2 {
          width: 36px; height: 36px; border-radius: 10px; background: #f3f0ff; color: #7c3aed;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .feature-icon-v2 svg { width: 18px !important; height: 18px !important; }
        .feature-item-v2 h4 { margin-bottom: 2px; font-size: 14px; font-weight: 700; }
        .feature-item-v2 p { color: #6b7280; line-height: 1.4; font-size: 12px; font-weight: 500; }

        .mini-stat-v2 { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
        .mini-stat-v2:last-child { border-bottom: none; }
        .mini-stat-v2 h2 { font-size: 18px; font-weight: 800; }
        .mini-stat-v2 p { color: #6b7280; font-size: 13px; font-weight: 500; }
        .mini-stat-v2 .icon { color: #9ca3af; }

        @media(max-width: 1150px) {
          .upload-app { flex-direction: column; gap: 12px; padding: 12px; }
          .sidebar-v2 { width: 100%; height: auto; position: static; padding: 16px; border-radius: 20px; }
          .content-grid-v2 { grid-template-columns: 1fr; }
        }

        @media(max-width: 700px) {
          .topbar-v2 { flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 14px; }
          .welcome-v2 h1 { font-size: 18px; margin-bottom: 2px; }
          .welcome-v2 p { font-size: 11px; }
          .profile-v2 { display: none; }
          .drop-area-v2 h2 { font-size: 17px; }
          .file-card-v2 { flex-direction: column; align-items: flex-start; gap: 12px; }
          .scan-btn-v2 { width: 100%; justify-content: center; }
        }
      `}</style>

      <div className="upload-page-bg">
        <div className="upload-app">
          {/* SIDEBAR */}
          <aside className="sidebar-v2">
            <div>
              <div className="brand-v2">
                <div className="brand-icon-v2">
                  <ScanSearch size={32} />
                </div>
                <div>
                  <h2>CGM<br/>Intelligence</h2>
                  <p>Document Upload System</p>
                </div>
              </div>

              <nav className="menu-v2">
                {menuItems.map((item, idx) => (
                  <Link 
                    key={idx} 
                    to={item.path} 
                    className={item.active ? 'active-v2' : ''}
                  >
                    <item.icon size={20} />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <button className="logout-v2" onClick={() => signOut(auth)}>
              <LogOut size={20} />
              Sign Out
            </button>
          </aside>

          {/* MAIN */}
          <main className="main-v2">
            {/* TOPBAR */}
            <div className="topbar-v2">
              <div className="welcome-v2">
                <h1>Document Upload Center ✨</h1>
                <p>Upload royalty PDFs and images for automated extraction.</p>
              </div>

              <div className="profile-v2">
                <div className="notif-btn-v2">
                  <Bell size={24} />
                </div>
                <div className="avatar-v2">
                  {auth.currentUser?.email?.substring(0, 2).toUpperCase() || 'AD'}
                </div>
              </div>
            </div>

            {/* CONTENT */}
            <div className="content-grid-v2">
              {/* LEFT */}
              <div className="upload-card-v2">
                <div className="section-title-v2">
                  <h2>Upload Document</h2>
                  <p>Drag & drop or browse your royalty PDF or mineral pass image.</p>
                </div>

                {/* DROP AREA */}
                <div 
                  className={`drop-area-v2 ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  <div className="upload-icon-box">
                    <CloudUpload size={52} className="text-[#7c3aed]" />
                  </div>
                  <h2>Upload PDF or Image</h2>
                  <p>Drop your file here or click below to browse</p>
                  
                  <input
                    type="file"
                    id="fileInput"
                    style={{ display: 'none' }}
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                  />

                  <button className="browse-btn-v2">
                    Choose File
                  </button>

                  <div className="formats-v2">
                    Supports PDF, PNG, JPG, JPEG up to 20MB
                  </div>
                </div>

                {/* FILE CARD */}
                <AnimatePresence>
                  {file && !result && (
                    <motion.div 
                      key="file-card"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="file-card-v2"
                    >
                      <div className="file-left-v2">
                        <div className="pdf-icon-v2">
                          {file.type.includes('pdf') ? 'PDF' : 'IMG'}
                        </div>
                        <div>
                          <div className="file-name-v2">{file.name}</div>
                          <div className="meta-v2">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for Scan
                          </div>
                        </div>
                      </div>

                      <button 
                        className="scan-btn-v2" 
                        onClick={handleUpload}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <>
                            <div className="spin-v2" />
                             Analyzing...
                          </>
                        ) : (
                          <>
                            <FileText size={18} />
                            Start Scan & Extract
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ERROR */}
                {error && (
                  <p className="text-red-500 font-bold mt-4 text-center bg-red-50 p-4 rounded-xl border border-red-100">
                    {error}
                  </p>
                )}

                {/* LOADER / SUCCESS */}
                <AnimatePresence>
                  {isUploading && (
                    <motion.div 
                      key="uploading-loader"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="extraction-loader"
                    >
                      <div className="spin-v2"></div>
                      Extracting document details...
                    </motion.div>
                  )}

                  {result && (
                    <motion.div 
                      key="success-message"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="extraction-loader !bg-green-50 !text-green-600 !border !border-green-100"
                    >
                      <BadgeCheck size={24} />
                      Extraction Completed Successfully
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* RIGHT */}
              <div className="side-panel-v2">
                {/* FEATURES */}
                <div className="side-card-v2">
                  <h3>Extraction Features</h3>

                  <div className="feature-item-v2">
                    <div className="feature-icon-v2">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h4>Smart Extraction</h4>
                      <p>Automatically parse and extract dispatch pass values from raw files.</p>
                    </div>
                  </div>

                  <div className="feature-item-v2">
                    <div className="feature-icon-v2">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h4>Secure Processing</h4>
                      <p>Files are encrypted and securely processed.</p>
                    </div>
                  </div>

                  <div className="feature-item-v2">
                    <div className="feature-icon-v2">
                      <Zap size={24} />
                    </div>
                    <div>
                      <h4>Fast Extraction</h4>
                      <p>Scan and extract information within seconds.</p>
                    </div>
                  </div>
                </div>

                {/* STATS */}
                <div className="side-card-v2">
                  <h3>Today's Activity</h3>

                  <div className="mini-stat-v2">
                    <div>
                      <h2>128</h2>
                      <p>Uploads</p>
                    </div>
                    <Upload size={28} className="icon" />
                  </div>

                  <div className="mini-stat-v2">
                    <div>
                      <h2>96%</h2>
                      <p>Accuracy</p>
                    </div>
                    <BadgeCheck size={28} className="icon" />
                  </div>

                  <div className="mini-stat-v2">
                    <div>
                      <h2>0.4s</h2>
                      <p>Avg Scan Time</p>
                    </div>
                    <Timer size={28} className="icon" />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
