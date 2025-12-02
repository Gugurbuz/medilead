
import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const TreatmentRecommendations = ({ recommendations }) => {
  const getPriorityBadge = (priority) => {
    const styles = {
      high: 'bg-red-100 text-red-700 border-red-200',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      low: 'bg-green-100 text-green-700 border-green-200'
    };
    return styles[priority] || styles.medium;
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'high') return AlertCircle;
    return CheckCircle2;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200"
    >
      <h3 className="text-2xl font-bold text-gray-900 mb-6">Treatment Recommendations</h3>
      
      <div className="space-y-6">
        {recommendations.map((treatment, index) => {
          const PriorityIcon = getPriorityIcon(treatment.priority);
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="border-2 border-gray-200 rounded-xl p-6 hover:border-indigo-300 hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-xl font-bold text-gray-900">{treatment.title}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityBadge(treatment.priority)}`}>
                      {treatment.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <p className="text-gray-600">{treatment.description}</p>
                </div>
                <PriorityIcon className={`w-6 h-6 flex-shrink-0 ml-4 ${treatment.priority === 'high' ? 'text-red-500' : 'text-green-500'}`} />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <h5 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Key Details:
                </h5>
                <ul className="space-y-2">
                  {treatment.details.map((detail, detailIndex) => (
                    <li key={detailIndex} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
        <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Recommendation Priority Guide
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full mt-1 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900">High Priority</div>
              <div className="text-gray-600">Most effective for your condition</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mt-1 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900">Medium Priority</div>
              <div className="text-gray-600">Complementary treatments</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900">Low Priority</div>
              <div className="text-gray-600">Optional enhancements</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TreatmentRecommendations;
