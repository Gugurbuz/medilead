import React, { useMemo, useState, memo } from 'react';
import { ChevronRight, Shield, Zap, Microscope, ArrowRight, UserCheck, Activity, Lock, Maximize2 } from 'lucide-react';
import { translations, LanguageCode } from '../translations';

interface LandingScreenProps {
  onStart: () => void;
  lang: LanguageCode;
}

const HairWaveBackground = memo(() => {
  const strands = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => {
      const yOffset = i * 40;
      const delay = (i % 5) * -4;
      const duration = 15 + (i % 10);
      const opacity = 0.08 + (i % 3) * 0.04;

      return {
        id: i,
        d: `M-100 ${100 + yOffset} C 300 ${-50 + yOffset}, 600 ${400 + yOffset}, 900 ${100 + yOffset} S 1500 ${400 + yOffset}, 1800 ${100 + yOffset}`,
        delay: `${delay}s`,
        duration: duration,
        opacity,
        isShimmer: i % 5 === 0
      };
    });
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <svg className="w-full h-full" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hair_grad_1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0E1A2B" stopOpacity="0" />
            <stop offset="50%" stopColor="#4A7C7C" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0E1A2B" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hair_grad_2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0E1A2B" stopOpacity="0" />
            <stop offset="50%" stopColor="#14B8A6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0E1A2B" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g className="opacity-40">
          {strands.map((s) => (
            <path
              key={s.id}
              d={s.d}
              stroke={s.id % 2 === 0 ? "url(#hair_grad_1)" : "url(#hair_grad_2)"}
              strokeWidth="0.8"
              fill="none"
              style={{
                opacity: s.opacity,
                animation: `hairFlowOrganic ${s.duration}s ease-in-out infinite, strandPulse ${s.duration * 0.7}s ease-in-out infinite`,
                animationDelay: s.delay
              }}
              className={s.isShimmer ? 'shimmer-line' : ''}
            />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 backdrop-blur-[2px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/5 via-transparent to-clinical-blue/10 pointer-events-none" />
    </div>
  );
});

HairWaveBackground.displayName = 'HairWaveBackground';

const BeforeAfterSlider = ({ lang }: { lang: LanguageCode }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const t = translations[lang];
  const isRTL = lang === 'AR';

  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-[16/9] rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl border border-slate-200 group bg-slate-100">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1618077360395-f3068be8e001?auto=format&fit=crop&q=80&w=1200"
          alt="Transplant Result - After"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className={`absolute bottom-8 ${isRTL ? 'left-8' : 'right-8'} px-4 py-2 bg-[#14B8A6] backdrop-blur-md rounded-lg text-white text-[10px] font-black tracking-widest uppercase border border-white/20 z-20 shadow-lg`}>
          {t.afterLabel}
        </div>
      </div>

      <div
        className="absolute inset-0 z-10 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${isRTL ? 0 : 100 - sliderPos}% 0 ${isRTL ? sliderPos : 0}%)` }}
      >
        <img
          src="https://images.unsplash.com/photo-1590038767624-dac5740a997b?auto=format&fit=crop&q=80&w=1200"
          alt="Scalp Recession - Before"
          className="w-full h-full object-cover grayscale brightness-90 contrast-110"
          loading="lazy"
        />
        <div className={`absolute bottom-8 ${isRTL ? 'right-8' : 'left-8'} px-4 py-2 bg-white/90 backdrop-blur-md rounded-lg text-[#0E1A2B] text-[10px] font-black tracking-widest uppercase border border-slate-200`}>
          {t.beforeLabel}
        </div>
      </div>

      <div className="absolute inset-0 z-30">
        <input
          type="range"
          min="0"
          max="100"
          value={sliderPos}
          onChange={(e) => setSliderPos(Number(e.target.value))}
          className="w-full h-full opacity-0 cursor-ew-resize"
        />
        <div
          className="absolute top-0 bottom-0 w-[2.5px] bg-white pointer-events-none shadow-[0_0_15px_rgba(255,255,255,0.8)]"
          style={{ [isRTL ? 'right' : 'left']: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-2xl flex items-center justify-center border-4 border-[#0E1A2B]">
            <Maximize2 className="w-4 h-4 text-[#0E1A2B] rotate-45" />
          </div>
        </div>
      </div>
    </div>
  );
};

const ShowcaseCard = ({ step, title, description, icon, image }: any) => (
  <div className="group relative bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-xl hover:shadow-2xl hover:border-teal-100 transition-all duration-500">
    <div className="aspect-[4/3] relative overflow-hidden">
      <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
      <div className="absolute top-6 left-6 w-12 h-12 bg-white rounded-xl shadow-lg flex items-center justify-center text-[#0E1A2B]">
        {icon}
      </div>
      <div className="absolute bottom-6 left-8">
        <span className="text-4xl font-black text-slate-100 uppercase tracking-tighter">{step}</span>
      </div>
    </div>
    <div className="p-8 space-y-4">
      <h3 className="text-xl font-bold text-[#0E1A2B]">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed font-light">{description}</p>
    </div>
  </div>
);

const LandingScreen: React.FC<LandingScreenProps> = ({ onStart, lang }) => {
  const t = translations[lang];
  const isRTL = lang === 'AR';

  return (
    <div className="w-full min-h-screen flex flex-col pt-32 pb-20 px-6 overflow-hidden relative bg-[#F7F8FA]">
      <HairWaveBackground />

      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#0E1A2B]/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative max-w-6xl mx-auto w-full space-y-32 z-10">
        <div className="text-center space-y-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-top-12 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-black uppercase tracking-widest text-teal-600 shadow-sm">
            <Zap className="w-3.5 h-3.5" />
            {t.heroTag}
          </div>
          <h1 className="text-5xl md:text-7xl font-light text-[#0E1A2B] tracking-tight leading-[1.05]">
            {t.heroTitle1} <span className="font-bold">{t.heroTitle2}</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto font-light">
            {t.heroDesc}
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onStart}
              className="w-full md:w-auto px-10 py-5 bg-[#0E1A2B] text-white rounded-2xl font-bold text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
            >
              <span className="relative z-10">{t.startBtn}</span>
              <ChevronRight className={`w-4 h-4 relative z-10 transition-transform ${isRTL ? 'rotate-180 group-hover:-translate-x-1' : 'group-hover:translate-x-1'}`} />
              <div className="absolute inset-0 bg-teal-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            </button>
            <button className="w-full md:w-auto px-10 py-5 bg-white border border-slate-200 text-[#0E1A2B] rounded-2xl font-bold text-sm uppercase tracking-[0.2em] shadow-md hover:bg-slate-50 transition-all">
              {t.methodBtn}
            </button>
          </div>
        </div>

        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-[#0E1A2B] tracking-tight">{t.transformationTitle}</h2>
            <p className="text-slate-500 font-light text-sm">{t.transformationDesc}</p>
          </div>
          <BeforeAfterSlider lang={lang} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-stretch pt-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
          <ShowcaseCard
            step="01"
            title={t.showcaseTitle1}
            description={t.showcaseDesc1}
            icon={<Microscope className="w-5 h-5" />}
            image="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=800"
          />
          <ShowcaseCard
            step="02"
            title={t.showcaseTitle2}
            description={t.showcaseDesc2}
            icon={<UserCheck className="w-5 h-5" />}
            image="https://images.unsplash.com/photo-1551288049-bbbda536339a?auto=format&fit=crop&q=80&w=800"
          />
          <ShowcaseCard
            step="03"
            title={t.showcaseTitle3}
            description={t.showcaseDesc3}
            icon={<ArrowRight className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />}
            image="https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=800"
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 pt-12 opacity-40 grayscale">
          <div className="flex items-center gap-2 font-bold text-[#0E1A2B] tracking-tighter"><Shield className="w-5 h-5" /> HIPAA COMPLIANT</div>
          <div className="flex items-center gap-2 font-bold text-[#0E1A2B] tracking-tighter"><Activity className="w-5 h-5" /> MEDICAL GRADE</div>
          <div className="flex items-center gap-2 font-bold text-[#0E1A2B] tracking-tighter"><Lock className="w-5 h-5" /> AES-256 ENCRYPTED</div>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;
