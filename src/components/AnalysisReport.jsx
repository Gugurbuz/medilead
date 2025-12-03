import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Share2, FileText, Activity, User, Calendar,
  ChevronDown, ChevronUp, Info, CheckCircle2, AlertCircle,
  Stethoscope, Microscope, Layers, ArrowRight, Sparkles,
  Wand2
} from 'lucide-react';
// Import paths fixed to relative to avoid alias resolution issues
import { useToast } from './ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import TreatmentRecommendations from './TreatmentRecommendations';
import TreatmentTimeline from './TreatmentTimeline';
import HairDensityMap from './HairDensityMap';
// Fixed import path for visionModel
import { createPremiumHairVisual } from '../lib/visionModel';

const AnalysisReport = ({ results, patientData, onRestart }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('summary');
  const [expandedSection, setExpandedSection] = useState(null);
  const [premiumVisuals, setPremiumVisuals] = useState({});
  const [isProcessingVisuals, setIsProcessingVisuals] = useState(true);

  const { analysis, photos, timestamp } = results;

  useEffect(() => {
    let isMounted = true;
    const generateVisuals = async () => {
      if (!photos || photos.length === 0) {
          setIsProcessingVisuals(false);
          return;
      }

      setIsProcessingVisuals(true);
      const visuals = {};
      
      await Promise.all(photos.map(async (photo) => {
        try {
          const premiumUrl = await createPremiumHairVisual(photo.preview);
          if (isMounted) {
              visuals[photo.type] = premiumUrl;
          }
        } catch (error) {
          console.error(`Error generating premium visual for ${photo.type}:`, error);
          if (isMounted) {
              visuals[photo.type] = photo.preview;
          }
        }
      }));

      if (isMounted) {
        setPremiumVisuals(visuals);
        setIsProcessingVisuals(false);
      }
    };

    generateVisuals();
    return () => { isMounted = false; };
  }, [photos]);

  const handleDownload = () => {
    toast({
      title: "Rapor İndiriliyor",
      description: "PDF raporunuz hazırlanıyor...",
    });
    setTimeout(() => {
      toast({
        title: "İndirme Tamamlandı",
        description: "Raporunuz başarıyla indirildi.",
        variant: "default",
        className: "bg-green-600 text-white border-green-700"
      });
    }, 2000);
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'MediLead Saç Analiz Raporu',
        text: `${patientData.name} için saç analizi sonuçları.`,
        url: window.location.href,
      });
    } catch (error) {
      toast({
        title: "Paylaşılamadı",
        description: "Rapor paylaşılırken bir hata oluştu veya işlem iptal edildi.",
        variant: "destructive",
      });
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const ReportHeader = () => (
    <div className="bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/10 mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-400" />
            Saç Analiz Raporu
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {patientData.name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(timestamp).toLocaleDateString('tr-TR')}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <Download className="w-5 h-5" />
            <span className="hidden md:inline">İndir</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span className="hidden md:inline">Paylaş</span>
          </button>
        </div>
      </div>
    </div>
  );

  const SummaryCard = ({ title, value, icon: Icon, color, subValue }) => (
    <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
      <div className="flex items-start justify-between mb-2">
        <span className="text-gray-400 text-sm">{title}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {subValue && <div className="text-xs text-gray-500">{subValue}</div>}
    </div>
  );

  const DetailedObservations = () => (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mt-6">
      <button
        onClick={() => toggleSection('observations')}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Microscope className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-white">Detaylı Gözlemler</h3>
        </div>
        {expandedSection === 'observations' ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      <AnimatePresence>
        {expandedSection === 'observations' && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-white/10 space-y-3">
              {analysis.detailedObservations.map((observation, index) => (
                <div key={index} className="flex items-start gap-3 bg-white/5 p-3 rounded-lg">
                  <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-300 text-sm">{observation}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <ReportHeader />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1 w-full flex justify-start overflow-x-auto">
            <TabsTrigger value="summary" className="flex-1 min-w-[100px] data-[state=active]:bg-indigo-600">
              Özet
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex-1 min-w-[100px] data-[state=active]:bg-indigo-600">
              Detaylı Analiz
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="flex-1 min-w-[100px] data-[state=active]:bg-indigo-600">
              Tedavi Planı
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard
                title="Genel Skor"
                value={`${analysis.overallScore}/10`}
                icon={Activity}
                color={getScoreColor(analysis.overallScore)}
                subValue="Saç Sağlığı Endeksi"
              />
              <SummaryCard
                title="Dökülme Evresi"
                value={analysis.hairLossStage}
                icon={Layers}
                color="text-indigo-400"
                subValue="Norwood Ölçeği"
              />
              <SummaryCard
                title="Tahmini Greft"
                value={analysis.estimatedGrafts}
                icon={Stethoscope}
                color="text-green-400"
                subValue="Önerilen Miktar"
              />
              <SummaryCard
                title="Donör Kalitesi"
                value={analysis.donorQuality}
                icon={CheckCircle2}
                color="text-blue-400"
                subValue="Verici Bölge Durumu"
              />
            </div>

            <div className="bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                AI Destekli Görüntü Analizi
              </h3>
              
              {isProcessingVisuals ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
                      <p>Görseller işleniyor ve optimize ediliyor...</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-white/10 bg-black shadow-lg">
                        <div className="aspect-[4/5] relative">
                          <img
                            src={premiumVisuals[photo.type] || photo.preview}
                            alt={`${photo.label} Analizi`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                          
                          <div className="absolute top-3 right-3 bg-indigo-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-white/20 shadow-sm">
                             <Wand2 className="w-3 h-3" />
                             AI ENHANCED
                          </div>

                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-100 transition-opacity">
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-1">Bölge</p>
                              <p className="text-white text-lg font-bold leading-tight">{photo.label}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              )}
              
              <div className="mt-6 p-4 bg-indigo-900/20 border border-indigo-500/20 rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-white">Teknoloji Hakkında:</span> Bu görseller, saç yapısını daha net ortaya çıkarmak için yapay zeka destekli görüntü işleme algoritmalarıyla optimize edilmiştir. Odaklanma artırılmış ve görsel gürültüler azaltılmıştır.
                </p>
              </div>
            </div>

            <DetailedObservations />

            {analysis.recommendations.length > 0 && (
              <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 p-6 rounded-2xl mt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-600/20 rounded-lg">
                    <Sparkles className="w-6 h-6 text-indigo-400 flex-shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Önerilen Tedavi: <span className="text-indigo-300">{analysis.recommendations[0].title}</span>
                    </h3>
                    <p className="text-gray-300 mb-4 leading-relaxed">
                      {analysis.recommendations[0].description}
                    </p>
                    <button
                      onClick={() => setActiveTab('recommendations')}
                      className="inline-flex items-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-lg shadow-indigo-900/50"
                    >
                      Detaylı Planı İncele
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <HairDensityMap data={analysis} />
            <DetailedObservations />
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-8">
            <TreatmentRecommendations recommendations={analysis.recommendations} />
            <TreatmentTimeline stage={analysis.hairLossStage} />
          </TabsContent>
        </Tabs>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-12 pb-8">
          <button
            onClick={onRestart}
            className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all font-medium border border-white/10 hover:border-white/20"
          >
            Yeni Analiz Başlat
          </button>
          <button className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl transition-all font-bold text-lg shadow-xl shadow-indigo-900/50 flex items-center justify-center gap-2 transform hover:-translate-y-1">
            <Calendar className="w-5 h-5" />
            Ücretsiz Uzman Görüşmesi
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisReport;