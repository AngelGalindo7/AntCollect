import React from 'react';
import { useNavigate } from 'react-router-dom';
import Search from '@/features/search/components/Search';

export const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 shrink-0 z-30">
      <div className="flex items-center gap-8 w-full">
        {/* Logo / Brand */}
        <div 
          className="flex items-center gap-2 cursor-pointer shrink-0" 
          onClick={() => navigate('/')}
        >
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
            P
          </div>
          <span className="text-xl font-bold text-gray-900 hidden md:block tracking-tight">
            PetrCollect
          </span>
        </div>

        {/* Search Bar Container */}
        <div className="flex-1 max-w-2xl" data-testid="header-search">
          <Search isHeaderSearch />
        </div>

        {/* Right side actions - Space for future additions */}
        <div className="flex items-center gap-4 shrink-0">
          {/* We could move some sidebar actions here if needed later */}
        </div>
      </div>
    </header>
  );
};

export default Header;
