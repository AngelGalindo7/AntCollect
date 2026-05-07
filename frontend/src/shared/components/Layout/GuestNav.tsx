import React from 'react';
import { Link } from 'react-router-dom';

export const GuestNav: React.FC = () => (
  <header className="w-full h-14 bg-campus-blue flex items-center justify-between px-6 shrink-0 shadow-sm z-20">
    <Link to="/" className="text-white font-bold text-lg tracking-tight">
      PetrCollect
    </Link>
    <div className="flex items-center gap-3">
      <Link
        to="/Login"
        className="px-4 py-1.5 text-sm font-medium text-white/90 hover:text-white transition-colors"
      >
        Sign In
      </Link>
      <Link
        to="/CreateAccount"
        className="px-4 py-1.5 text-sm font-semibold bg-campus-gold text-espresso rounded-lg hover:opacity-90 transition-opacity"
      >
        Create Account
      </Link>
    </div>
  </header>
);
