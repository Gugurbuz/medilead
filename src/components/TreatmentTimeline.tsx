
import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2 } from 'lucide-react';

const TreatmentTimeline = ({ timeline }) => {
  const timeframes = [
    { key: 'immediate', label: 'Immediate Actions', color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50' },
    { key: 'threeMonths', label: '3 Months', color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50' },
    { key: 'sixMonths', label: '6 Months', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50' },
    { key: 'oneYear', label: '12 Months', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50' }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200"
    >
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-6 h-6 text-indigo-600" />
        <h3 className="text-2xl font-bold text-gray-900">Treatment Timeline</h3>
      </div>

      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-500 via-yellow-500 to-green-500" />

        <div className="space-y-8">
          {timeframes.map((timeframe, index) => {
            const actions = timeline[timeframe.key] || [];
            
            return (
              <motion.div
                key={timeframe.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.15 }}
                className="relative pl-20"
              >
                <div className={`absolute left-0 w-16 h-16 ${timeframe.color} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}>
                  <div className="text-center">
                    <div className="text-xs">Month</div>
                    <div className="text-lg">{index === 0 ? '0' : index === 1 ? '3' : index === 2 ? '6' : '12'}</div>
                  </div>
                </div>

                <div className={`${timeframe.bgColor} rounded-xl p-6 border-2 border-gray-200`}>
                  <h4 className={`text-lg font-bold ${timeframe.textColor} mb-4`}>
                    {timeframe.label}
                  </h4>
                  
                  <ul className="space-y-3">
                    {actions.map((action, actionIndex) => (
                      <motion.li
                        key={actionIndex}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 + index * 0.15 + actionIndex * 0.05 }}
                        className="flex items-start gap-3 text-gray-700"
                      >
                        <CheckCircle2 className={`w-5 h-5 ${timeframe.textColor} flex-shrink-0 mt-0.5`} />
                        <span className="font-medium">{action}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 bg-indigo-50 border border-indigo-200 rounded-xl p-6">
        <h4 className="font-semibold text-indigo-900 mb-2">Timeline Notes:</h4>
        <ul className="space-y-1 text-sm text-indigo-800">
          <li>• Individual results may vary based on adherence to treatment plan</li>
          <li>• Regular follow-ups are essential for monitoring progress</li>
          <li>• Timeline may be adjusted based on your response to treatment</li>
          <li>• Consistency is key to achieving optimal results</li>
        </ul>
      </div>
    </motion.div>
  );
};

export default TreatmentTimeline;
