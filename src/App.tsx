import React, { useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/toaster';
import PatientDashboard from '@/components/PatientDashboard';
import LandingScreen from '@/components/LandingScreen';
import { LanguageCode } from './translations';

function App() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('EN');

  useEffect(() => {
    document.title = 'Hair Loss Analysis - Patient Portal';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Upload photos and receive AI-powered hair loss analysis with personalized treatment recommendations');
    }
  }, []);

  const handleStart = () => {
    setShowDashboard(true);
  };

  if (!showDashboard) {
    return (
      <>
        <LandingScreen onStart={handleStart} lang={language} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <PatientDashboard />
      <Toaster />
    </div>
  );
}

export default App;