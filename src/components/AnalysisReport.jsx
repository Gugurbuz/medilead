
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw, TrendingUp, AlertCircle, CheckCircle2, Clock, Lock, Mail, Phone, User, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import HairDensityMap from '@/components/HairDensityMap';
import TreatmentRecommendations from '@/components/TreatmentRecommendations';
import TreatmentTimeline from '@/components/TreatmentTimeline';
import GetQuote from './GetQuote';
import MatchedClinics from './MatchedClinics';
import VisualAnalysis from './VisualAnalysis';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const AnalysisReport = ({ data, patientData, photos, onStartOver }) => {
  const { toast } = useToast();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef(null);

  const [leadData, setLeadData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    const savedLead = localStorage.getItem('lead_contact_info');
    if (savedLead) {
      try {
        setLeadData(JSON.parse(savedLead));
        setIsUnlocked(true);
      } catch (e) {
        console.error("Error parsing lead info", e);
      }
    }
  }, []);

  const handleLeadSubmit = (e) => {
    e.preventDefault();
    
    if (!leadData.name.trim() || !leadData.email.trim() || !leadData.phone.trim()) {
      toast({
        title: "Missing Information",
        description: "Please complete all fields to unlock your report.",
        variant: "destructive"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(leadData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem('lead_contact_info', JSON.stringify(leadData));
    setIsUnlocked(true);
    
    toast({
      title: "Report Unlocked!",
      description: "You now have full access to your personalized analysis.",
      className: "bg-green-50 border-green-200 text-green-900"
    });
  };

  const handleDownload = async () => {
    if (!reportRef.current) return;

    try {
      setIsDownloading(true);
      toast({
        title: "Generating PDF...",
        description: "Preparing your comprehensive analysis report.",
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (element) => element.classList.contains('no-print'),
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Hair_Analysis_Report_${new Date().toISOString().slice(0,10)}.pdf`);

      toast({
        title: "Download Complete",
        description: "Your analysis report has been saved to your device.",
        className: "bg-green-50 border-green-200 text-green-900"
      });

    } catch (error) {
      console.error("PDF generation failed", error);
      toast({
        title: "Download Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Moderate';
    return 'Significant Concern';
  };

  return (
    <div className="relative min-h-screen">
      <GetQuote
        isOpen={showQuote}
        onClose={() => setShowQuote(false)}
        analysisData={data}
        photos={photos}
      />

      {!isUnlocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-indigo-100"
          >
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Analysis Complete!</h2>
                <p className="text-indigo-100 text-sm leading-relaxed">
                  Your AI hair assessment is ready. Enter your details below to unlock your personalized report and treatment plan.
                </p>
              </div>
            </div>
            
            <div className="p-8 bg-white">
              <form onSubmit={handleLeadSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-3 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      value={leadData.name}
                      onChange={e => setLeadData({...leadData, name: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      value={leadData.email}
                      onChange={e => setLeadData({...leadData, email: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 focus:bg-white"
                      value={leadData.phone}
                      onChange={e => setLeadData({...leadData, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-lg py-6 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 group"
                  >
                    Unlock My Report
                    <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <p className="text-xs text-gray-400 text-center mt-4">
                    We respect your privacy. Your data is secure and never shared without permission.
                  </p>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      <motion.div
        ref={reportRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        className={`max-w-6xl mx-auto space-y-8 transition-all duration-500 ${!isUnlocked ? 'filter blur-xl opacity-50 pointer-events-none select-none h-[100vh] overflow-hidden' : ''}`}
        aria-hidden={!isUnlocked}
      >
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">AI Analysis Report</h2>
              <p className="text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold text-green-700">Gemini 2.0 Verified</span>
                </div>
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                  <span className="text-xs font-semibold text-blue-700">{photos.length} Photos Analyzed</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 no-print">
              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                variant="outline"
                className="border-indigo-600 text-indigo-600 hover:bg-indigo-50"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
              <Button
                onClick={onStartOver}
                variant="outline"
                className="border-gray-300 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                New Analysis
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className={`rounded-xl p-6 ${getScoreColor(data.overallScore)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium opacity-80">Overall Assessment</span>
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="text-3xl font-bold mb-1">{data.overallScore}/10</div>
              <div className="text-sm font-medium">{getScoreLabel(data.overallScore)}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-blue-100 text-blue-700 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium opacity-80">Hair Loss Stage</span>
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="text-lg font-bold">{data.hairLossStage}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-purple-100 text-purple-700 rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium opacity-80">Donor Quality</span>
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-lg font-bold">{data.donorQuality}</div>
              <div className="text-sm mt-1">{data.estimatedGrafts} grafts</div>
            </motion.div>
          </div>
        </div>

        {/* Detailed Visual Analysis Component */}
        <VisualAnalysis analyzedPhotos={photos} />

        <HairDensityMap densityData={data.hairDensity} />

        {data.recessionPattern && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Recession Pattern Analysis</h3>
                <p className="text-sm text-gray-500">AI-detected hair loss progression markers</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(data.recessionPattern).map(([key, value], index) => {
                const labels = {
                  frontalRecession: 'Frontal Hairline',
                  crownThinning: 'Crown Area',
                  templeRecession: 'Temple Regions'
                };
                const colors = {
                  none: 'bg-green-100 text-green-700 border-green-200',
                  mild: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                  moderate: 'bg-orange-100 text-orange-700 border-orange-200',
                  severe: 'bg-red-100 text-red-700 border-red-200'
                };
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    className={`p-4 rounded-lg border-2 ${colors[value] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                  >
                    <div className="text-sm font-medium opacity-80 mb-1">{labels[key]}</div>
                    <div className="text-lg font-bold capitalize">{value}</div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {data.detailedObservations && data.detailedObservations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">AI Clinical Observations</h3>
                <p className="text-sm text-gray-500">Detailed findings from Gemini vision analysis</p>
              </div>
            </div>
            <div className="space-y-3">
              {data.detailedObservations.map((observation, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="flex gap-3 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100"
                >
                  <div className="flex-shrink-0 w-6 h-6 bg-indigo-200 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm mt-0.5">
                    {index + 1}
                  </div>
                  <p className="text-gray-700 leading-relaxed">{observation}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <TreatmentRecommendations recommendations={data.recommendations} />

        <TreatmentTimeline timeline={data.timeline} />

        <MatchedClinics />

        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-lg p-8 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full transform translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform duration-700"></div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm shadow-inner">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold mb-2">Ready to Restore Your Hair?</h3>
              <p className="text-emerald-100 mb-0 max-w-2xl text-lg">
                Ready to take the next step? Get personalized quotes from top-rated hair restoration clinics tailored to your analysis.
              </p>
            </div>
            <Button
              onClick={() => setShowQuote(true)}
              className="bg-white text-emerald-600 hover:bg-emerald-50 px-8 py-6 text-lg font-bold shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1"
            >
              Get Free Quotes
            </Button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 mb-1">Important Disclaimer</h4>
              <p className="text-sm text-amber-800">
                This AI-generated analysis is for informational purposes only and should not be considered as medical advice. 
                Please consult with a qualified healthcare professional or hair transplant surgeon for a comprehensive evaluation 
                and personalized treatment recommendations.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AnalysisReport;
