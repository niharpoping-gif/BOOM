import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { Printer, Download, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { motion } from 'motion/react';

export default function PassDetails() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get passId from either :passId or the catch-all *
  const rawPassId = params['*'] || params.passId || '';
  // Clean up leading/trailing slashes if any
  const passId = rawPassId.replace(/^\/+|\/+$/g, '');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineCache, setIsOfflineCache] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchPass() {
      if (!passId) {
        setError("No DC Pass number provided.");
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        console.log("Fetching pass with ID:", passId);
        
        // Try fetching from the local free backend API first
        try {
          const resp = await fetch(`/api/passes/${encodeURIComponent(passId)}`);
          if (resp.ok) {
            const passData = await resp.json();
            setData(passData);
            setIsOfflineCache(false);
            try {
              localStorage.setItem(`cgm_pass_${passId}`, JSON.stringify(passData));
            } catch (e) {}
            setLoading(false);
            return;
          }
        } catch (apiErr) {
          console.warn("Backend fetch failed, attempting local cache fallback:", apiErr);
        }

        // Fallback to local cache if offline/backend is unreachable
        try {
          const individualCached = localStorage.getItem(`cgm_pass_${passId}`) || localStorage.getItem(`cgm_pass_${decodeURIComponent(passId)}`);
          if (individualCached) {
            console.log("Using cached pass from individual storage:", passId);
            setData(JSON.parse(individualCached));
            setIsOfflineCache(true);
            setLoading(false);
            return;
          }

          const cachedPassesStr = localStorage.getItem('cgm_passes_cache');
          if (cachedPassesStr) {
            const cachedPasses = JSON.parse(cachedPassesStr);
            const found = cachedPasses.find((p: any) => 
              p.id === passId || p.dcPassNo === passId || 
              p.id === decodeURIComponent(passId) || p.dcPassNo === decodeURIComponent(passId)
            );
            if (found) {
              console.log("Using cached pass from dashboard list:", found);
              setData(found);
              setIsOfflineCache(true);
              setLoading(false);
              return;
            }
          }
        } catch (cacheErr) {
          console.warn("Failed to retrieve pass from fallback cache:", cacheErr);
        }

        setError("DC Pass not found. Please verify the number or check your connection.");
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError("Error fetching digital pass: " + (err.message || err));
      } finally {
        setLoading(false);
      }
    }
    fetchPass();
  }, [passId]);

  const downloadPDF = async () => {
    if (!data) return;
    try {
      const sanitizedId = data.id || data.dcPassNo.replace(/\//g, '_');
      const downloadUrl = `/api/passes/${encodeURIComponent(sanitizedId)}/file`;
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Original-Pass-${data.dcPassNo.replace(/\//g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Download error:", err);
      alert("Failed to download file: " + (err.message || err));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Retrieving digital pass...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h1>
        <p className="text-gray-500 mb-8">{error || "Something went wrong."}</p>
        <button 
          onClick={() => navigate(-1)}
          className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg active:scale-95 transition-all"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .pass-page-bg {
          background: #f4f4f4;
          font-family: Arial, Helvetica, sans-serif;
          color: #1d1d1d;
          min-height: 100vh;
        }

        .pass-container {
          max-width: 480px;
          margin: auto;
          background: white;
          min-height: 100vh;
          position: relative;
          box-shadow: 0 0 20px rgba(0,0,0,0.05);
        }

        /* TOP BAR */
        .pass-topbar {
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          background: #fafafa;
          border-bottom: 1px solid #efefef;
        }

        .pass-topbar .pass-domain {
          font-size: 14px;
          font-weight: 600;
          color: #2d2d2d;
        }

        .pass-close-btn {
          position: absolute;
          left: 14px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #5a5a5a;
          cursor: pointer;
        }

        .pass-menu-btn {
          position: absolute;
          right: 14px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: #5a5a5a;
          cursor: pointer;
        }

        /* CONTENT */
        .pass-content {
          padding: 12px;
        }

        /* HEADER */
        .pass-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .pass-logo {
          width: 44px;
          height: 44px;
          object-fit: contain;
        }

        .pass-header-right {
          flex: 1;
        }

        .pass-header-title {
          font-size: 10px;
          line-height: 1.4;
          color: #3d3d3d;
          font-weight: 600;
        }

        /* GREEN BAR */
        .pass-green-bar {
          width: 100%;
          background: #5f711f;
          color: white;
          text-align: center;
          padding: 6px 0;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        /* GOV TEXT */
        .pass-govt {
          text-align: center;
          margin-bottom: 12px;
        }

        .pass-govt h3 {
          font-size: 13px;
          line-height: 1.4;
          font-weight: 700;
        }

        /* DIVIDER */
        .pass-line {
          border-top: 1px solid #d7d7d7;
          margin: 10px 0;
        }

        /* DETAILS */
        .pass-row {
          margin-bottom: 10px;
          font-size: 14px;
          line-height: 1.45;
        }

        .pass-label {
          font-weight: 700;
        }

        .pass-big-pass {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: .3px;
          margin-top: 4px;
          word-break: break-all;
        }

        /* QR */
        .pass-qr-box {
          text-align: center;
          margin: 14px 0;
          display: flex;
          justify-content: center;
        }

        /* BUTTONS */
        .pass-buttons {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 16px;
        }

        .pass-btn {
          background: #6a1fe6;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: background 0.2s;
        }

        .pass-btn:hover {
          background: #5716c0;
        }

        .pass-btn-secondary {
          background: #e5e7eb;
          color: #374151;
        }

        .pass-btn-secondary:hover {
          background: #d1d5db;
        }

        /* FOOTER */
        .pass-footer {
          padding: 18px 12px;
          font-size: 11px;
          color: #777;
          line-height: 1.6;
          text-align: center;
          border-top: 1px solid #eee;
          margin-top: 12px;
        }

        @media(max-width:480px){
          .pass-row { font-size: 13px; }
          .pass-green-bar { font-size: 13px; }
          .pass-govt h3 { font-size: 12px; }
        }
      `}</style>

      <div className="pass-page-bg">
        <div className="pass-container" id="pass-content" ref={printRef}>
          {/* CONTENT */}
          <div className="pass-content">
            {/* GREEN BAR */}
            <div className="pass-green-bar">
              QR Code based - DC Pass
            </div>



            {/* GOVT */}
            <div className="pass-govt">
              <h3>
                Commissioner of Geology Mining<br />
                Industries and Mines Department<br />
                (Government of Gujarat)
              </h3>
            </div>

            <div className="pass-line"></div>

            {/* DETAILS */}
            <div className="pass-row">
              <span className="pass-label">Royalty Issued on:</span><br />
              {data.royaltyIssuedOn || 'N/A'}
            </div>

            <div className="pass-line"></div>

            <div className="pass-row">
              <span className="pass-label">DC Pass No.</span>
              <div className="pass-big-pass">{data.dcPassNo}</div>
            </div>

            {/* QR */}
            <div className="pass-qr-box">
              <QRCodeCanvas 
                value={`${window.location.origin}/pass/${data.dcPassNo}`} 
                size={160}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="pass-line"></div>

            <div className="pass-row">
              <span className="pass-label">Vehicle No./(Carrier) Type:</span><br />
              {data.vehicleNo || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Mineral Name (Grade):</span><br />
              {data.mineralName || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Net Weight in MT:</span><br />
              {data.netWeight || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Concession Holder Name:</span><br />
              {data.concessionHolderName || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Source of Place:</span><br />
              {data.sourcePlace || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Name of Purchaser:</span><br />
              {data.purchaserName || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Destination / Address:</span><br />
              {data.destination || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Distance:</span><br />
              {data.distance || '0 Km'}
            </div>

            <div className="pass-line"></div>

            <div className="pass-row">
              <span className="pass-label">Journey Start Dt:</span><br />
              {data.journeyStart || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Journey End Dt:</span><br />
              {data.journeyEnd || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Route name:</span><br />
              {data.routeName || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Duration:</span><br />
              {data.duration || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Checkpost:</span><br />
              {data.checkpost || 'N/A'}
            </div>

            <div className="pass-line"></div>

            <div className="pass-row">
              <span className="pass-label">Driver Name:</span><br />
              {data.driverName || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Driver’s License No:</span><br />
              {data.driverLicense || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Driver Mobile No:</span><br />
              {data.driverMobile || 'N/A'}
            </div>

            <div className="pass-line"></div>

            <div className="pass-row">
              <span className="pass-label">PAN Number / GSTIN:</span><br />
              {data.panGstin || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">GPS Tracking Device Details:</span><br />
              {data.gpsDetails || 'N/A'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Transporter Name:</span><br />
              {data.transporterName || 'SELF'}
            </div>

            <div className="pass-row">
              <span className="pass-label">Buyer Mobile Number:</span><br />
              {data.buyerMobile || 'N/A'}
            </div>

            {/* BUTTONS */}
            <div className="pass-buttons no-print">
              <button className="pass-btn" onClick={downloadPDF}>
                <Download size={15} />
                Download
              </button>
              <button 
                className="pass-btn pass-btn-secondary" 
                onClick={() => navigate(-1)}
              >
                Back
              </button>
            </div>
          </div>

          {/* FOOTER */}
          <div className="pass-footer">
            2024© Developed by (n)Code Solutions-A Div of GNFC Ltd.<br />
            <strong>Version : 1.0</strong>
          </div>
        </div>
      </div>
    </>
  );
}
