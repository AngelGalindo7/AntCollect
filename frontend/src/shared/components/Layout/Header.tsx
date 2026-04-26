import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="h-10 bg-warm-cream border-b border-warm-gray/50 flex items-center px-4 shrink-0 z-30">
      <span className="flex-1 text-sm font-bold uppercase tracking-widest text-espresso/60">Feed</span>
      <button
        onClick={() => navigate('/search')}
        className="p-1.5 rounded-lg text-espresso/50 hover:text-espresso hover:bg-warm-gray/20 transition-colors"
        aria-label="Search"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    </header>
  );
};

export default Header;
