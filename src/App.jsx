
import React from 'react';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import PatientDashboard from '@/components/PatientDashboard';

function App() {
  return (
    <>
      <Helmet>
        <title>Hair Loss Analysis - Patient Portal</title>
        <meta name="description" content="Upload photos and receive AI-powered hair loss analysis with personalized treatment recommendations" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <PatientDashboard />
        <Toaster />
      </div>
    </>
  );
}

export default App;
