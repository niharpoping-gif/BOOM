import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/admin');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Failed to sign in. Check if Email/Password is enabled in Firebase Console.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-page-bg, .login-page-bg * {
          box-sizing: border-box;
        }

        .login-page-bg {
          background: #f5f5f7;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-x: hidden;
          position: relative;
          font-family: 'Inter', sans-serif;
        }

        .blur1, .blur2 {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          z-index: 0;
        }

        .blur1 {
          width: 280px;
          height: 280px;
          background: #7c3aed;
          top: -60px;
          left: -60px;
          opacity: 0.25;
        }

        .blur2 {
          width: 300px;
          height: 300px;
          background: #c084fc;
          bottom: -80px;
          right: -80px;
          opacity: 0.2;
        }

        .login-card {
          width: 100%;
          max-width: 380px;
          background: white;
          border-radius: 24px;
          padding: 24px;
          position: relative;
          z-index: 2;
          box-shadow: 0 20px 50px rgba(0,0,0,0.08);
        }

        .logo-box {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 15px 30px rgba(124,58,237,0.35);
          margin: 0 auto 16px;
        }
        .logo-box svg { width: 32px !important; height: 32px !important; }

        .login-title {
          text-align: center;
          margin-bottom: 6px;
          font-size: 24px;
          font-weight: 800;
          color: #111827;
        }

        .login-subtitle {
          text-align: center;
          color: #6b7280;
          margin-bottom: 20px;
          line-height: 1.5;
          font-size: 13px;
        }

        .input-group {
          margin-bottom: 12px;
        }

        .input-label {
          display: block;
          margin-bottom: 6px;
          font-weight: 600;
          color: #374151;
          font-size: 13px;
        }

        .input-wrap {
          position: relative;
        }

        .input-wrap .icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .form-input {
          width: 100%;
          height: 48px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          padding-left: 44px;
          padding-right: 14px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          transition: 0.2s;
          background: #fafafa;
          outline: none;
        }

        .form-input:focus {
          border-color: #7c3aed;
          background: white;
          box-shadow: 0 0 0 4px rgba(124,58,237,0.08);
        }

        .toggle-pass {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
        }

        .login-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 12px 0 18px;
          font-size: 13px;
        }

        .remember-me {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6b7280;
          cursor: pointer;
        }

        .login-btn {
          width: 100%;
          height: 48px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
          box-shadow: 0 12px 25px rgba(124,58,237,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .login-btn:hover {
          transform: translateY(-2px);
          opacity: 0.95;
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .login-divider {
          text-align: center;
          margin: 18px 0;
          color: #9ca3af;
          position: relative;
          font-size: 12px;
        }

        .login-divider::before,
        .login-divider::after {
          content: "";
          position: absolute;
          top: 50%;
          width: 35%;
          height: 1px;
          background: #ececec;
        }

        .login-divider::before { left: 0; }
        .login-divider::after { right: 0; }

        .login-footer {
          text-align: center;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.6;
        }

        .login-footer strong {
          color: #7c3aed;
        }

        @media(max-width:480px){
          .login-card { padding: 20px 16px; border-radius: 20px; }
          .login-title { font-size: 20px; }
          .form-input { height: 42px; }
          .login-btn { height: 44px; }
        }
      `}</style>

      <div className="login-page-bg">
        <div className="blur1"></div>
        <div className="blur2"></div>

        <motion.div 
          className="login-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="logo-box">
            <ShieldCheck size={40} />
          </div>

          <h1 className="login-title">Admin Login</h1>
          <p className="login-subtitle">
            Secure access to the CGM Intelligence dashboard and AI document system.
          </p>

          <form onSubmit={handleEmailLogin}>
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="input-wrap">
                <Mail size={20} className="icon" />
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@cgm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-wrap">
                <Lock size={20} className="icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <span 
                  className="toggle-pass" 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </span>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-xs mt-2 mb-4 text-center font-medium">
                {error}
              </p>
            )}

            <div className="login-options">
              <label className="remember-me">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300" />
                Remember me
              </label>
              <span className="text-[#7c3aed] font-semibold cursor-default">
                Forgot Password?
              </span>
            </div>

            <button 
              type="submit" 
              className="login-btn"
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Sign In to Dashboard"}
            </button>
          </form>

          <div className="login-divider">
            Secure AI Authentication
          </div>

          <div className="login-footer">
            Powered by <strong>CGM Intelligence</strong><br />
            Smart • Secure • Intelligent
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Login;
