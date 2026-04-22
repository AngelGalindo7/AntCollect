import React from 'react';
import Search from '@/features/search/components/Search';

export const Header: React.FC = () => {
  return (
    <header className="h-16 bg-warm-cream border-b border-warm-gray/50 flex items-center shrink-0 z-30">
      <div className="flex items-center w-full h-full">
        <div className="flex-1 h-full" data-testid="header-search">
          <Search isHeaderSearch />
        </div>
      </div>
    </header>
  );
};

export default Header;
