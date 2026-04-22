import React from 'react';
import Search from '@/features/search/components/Search';

export const Header: React.FC = () => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 shrink-0 z-30">
      <div className="flex items-center w-full">
        {/* Search Bar Container - Centered and clean */}
        <div className="flex-1 max-w-2xl mx-auto" data-testid="header-search">
          <Search isHeaderSearch />
        </div>
      </div>
    </header>
  );
};

export default Header;
