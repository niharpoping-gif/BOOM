import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { auth } from './firebase';
import AdminUpload from './pages/AdminUpload';
import AdminDashboard from './pages/AdminDashboard';
import PassDetails from './pages/PassDetails';
import Login from './pages/Login';
import { LayoutDashboard, FileUp, LogIn, LogOut, ShieldCheck } from 'lucide-react';

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-9xl font-black text-gray-200">404</h1>
        <h2 className="text-2xl font-bold text-gray-900">Page Not Found</h2>
        <p className="text-gray-500">The page you are looking for doesn't exist or has been moved.</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  if (user === undefined) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  if (user === null) return <Navigate to="/login" />;

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NotFound />} />
        <Route path="/login" element={<Login />} />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/upload" 
          element={
            <ProtectedRoute>
              <AdminUpload />
            </ProtectedRoute>
          } 
        />
        <Route path="/pass/*" element={<PassDetails />} />
        <Route path="/dcpass/*" element={<PassDetails />} />
        <Route path="/:passId" element={<PassDetails />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
