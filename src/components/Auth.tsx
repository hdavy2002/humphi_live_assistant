import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { motion } from 'motion/react';

export default function Auth() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full flex justify-center"
      >
        <SignIn />
      </motion.div>
    </div>
  );
}
