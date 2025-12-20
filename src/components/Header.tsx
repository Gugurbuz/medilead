
import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Home } from 'lucide-react';

interface HeaderProps {
  onGoToHomepage?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onGoToHomepage }) => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white border-b border-gray-200 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Hair Loss Analysis</h1>
              <p className="text-sm text-gray-500">AI-Powered Patient Assessment</p>
            </div>
          </div>
          {onGoToHomepage && (
            <button
              onClick={onGoToHomepage}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
          )}
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
