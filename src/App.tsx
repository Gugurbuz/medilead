import React, { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import PatientDashboard from '@/components/PatientDashboard';

function App() {
  useEffect(() => {
    document.title = 'Hair Loss Analysis - Patient Portal';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Upload photos and receive AI-powered hair loss analysis with personalized treatment recommendations');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <PatientDashboard />
      <Toaster />
    </div>
  );
}

export default App;