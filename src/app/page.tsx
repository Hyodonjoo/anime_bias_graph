'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center"
      >
        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-6">
          Anime Bias Sharing
        </h1>
        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          Share your favorite anime by year using our interactive card system.
          Drag, drop, and export your bias list!
        </p>

        <div className="flex gap-4 justify-center">
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
            Start Creating
          </button>
          <Link href="/admin">
            <span className="px-6 py-3 border border-gray-600 hover:border-gray-400 rounded-lg font-semibold transition-colors inline-block cursor-pointer">
              Admin Login
            </span>
          </Link>
        </div>
      </motion.div>

      {/* Placeholder for the Grid/Canvas */}
      <motion.div
        className="mt-16 w-full max-w-5xl h-96 bg-gray-800/50 rounded-xl border border-gray-700 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      >
        <p className="text-gray-500">Interactive Grid Canvas (Coming Soon)</p>
      </motion.div>
    </main>
  );
}
