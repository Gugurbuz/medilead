import React from 'react';
import { ChevronRight, Sparkles, CheckCircle2, Camera, Brain, FileCheck } from 'lucide-react';
import { translations, LanguageCode } from '../translations';

interface LandingScreenProps {
  onStart: () => void;
  lang: LanguageCode;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ onStart, lang }) => {
  const t = translations[lang];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-16 text-center lg:pt-32">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 rounded-full text-xs font-semibold text-teal-700 mb-8">
            <Sparkles className="w-4 h-4" />
            AI-Powered Hair Analysis
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight mb-6">
            {t.heroTitle1}
            <br />
            <span className="text-teal-600">{t.heroTitle2}</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t.heroDesc}
          </p>

          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-lg font-semibold text-base hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            {t.startBtn}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="py-16 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-100 rounded-2xl">
              <Camera className="w-7 h-7 text-teal-700" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{t.showcaseTitle1}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{t.showcaseDesc1}</p>
          </div>

          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl">
              <Brain className="w-7 h-7 text-blue-700" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{t.showcaseTitle2}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{t.showcaseDesc2}</p>
          </div>

          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-2xl">
              <FileCheck className="w-7 h-7 text-green-700" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{t.showcaseTitle3}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{t.showcaseDesc3}</p>
          </div>
        </div>

        <div className="py-16 border-t border-slate-200">
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
              <span>Medical Grade</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
              <span>Secure & Private</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;
