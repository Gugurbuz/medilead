
import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const HairDensityMap = ({ densityData }) => {
  const getDensityColor = (density) => {
    if (density >= 75) return 'bg-green-500';
    if (density >= 50) return 'bg-yellow-500';
    if (density >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getDensityIcon = (density) => {
    if (density >= 75) return TrendingUp;
    if (density >= 50) return Minus;
    return TrendingDown;
  };

  const areas = [
    { key: 'frontal', label: 'Frontal Area', position: 'top-4 left-1/2 -translate-x-1/2' },
    { key: 'crown', label: 'Crown Area', position: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
    { key: 'temporal', label: 'Temporal Regions', position: 'top-1/3 left-4' },
    { key: 'donor', label: 'Donor Area', position: 'bottom-4 left-1/2 -translate-x-1/2' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200"
    >
      <h3 className="text-2xl font-bold text-gray-900 mb-6">Hair Density Analysis</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-8 min-h-[400px] flex items-center justify-center">
          <div className="relative w-48 h-64">
            <svg viewBox="0 0 100 150" className="w-full h-full">
              <ellipse cx="50" cy="30" rx="35" ry="45" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="2"/>
              
              <ellipse cx="50" cy="20" rx="28" ry="15" fill={getDensityColor(densityData.frontal)} opacity="0.6"/>
              
              <ellipse cx="50" cy="40" rx="20" ry="20" fill={getDensityColor(densityData.crown)} opacity="0.6"/>
              
              <ellipse cx="25" cy="30" rx="8" ry="12" fill={getDensityColor(densityData.temporal)} opacity="0.6"/>
              <ellipse cx="75" cy="30" rx="8" ry="12" fill={getDensityColor(densityData.temporal)} opacity="0.6"/>
              
              <rect x="15" y="65" width="70" height="15" rx="5" fill={getDensityColor(densityData.donor)} opacity="0.6"/>
            </svg>
            
            {areas.map((area, index) => {
              const Icon = getDensityIcon(densityData[area.key]);
              return (
                <motion.div
                  key={area.key}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className={`absolute ${area.position} w-8 h-8 ${getDensityColor(densityData[area.key])} rounded-full flex items-center justify-center text-white shadow-lg`}
                >
                  <Icon className="w-4 h-4" />
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(densityData).map(([key, value], index) => {
            const area = areas.find(a => a.key === key);
            const Icon = getDensityIcon(value);
            
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getDensityColor(value)}`} />
                    <span className="font-semibold text-gray-900">{area?.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${value >= 75 ? 'text-green-600' : value >= 50 ? 'text-yellow-600' : 'text-red-600'}`} />
                    <span className="font-bold text-gray-900">{value}%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1, delay: 0.8 + index * 0.1 }}
                    className={`h-full ${getDensityColor(value)}`}
                  />
                </div>
              </motion.div>
            );
          })}

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Density Scale:</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span>75-100%: Excellent density</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span>50-74%: Moderate thinning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full" />
                <span>25-49%: Significant thinning</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span>0-24%: Severe hair loss</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HairDensityMap;
