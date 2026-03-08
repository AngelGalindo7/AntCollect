import React from 'react';
import { NavLink } from 'react-router-dom';
import { useUIStore } from '@/shared/store/useUIStore';

export const SideBar: React.FC = () => {
  const openCreatePostModal = useUIStore((state) => state.openCreatePostModal);

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full px-2 py-3 flex items-center justify-center transition-colors duration-200 ${
      isActive ? 'text-gray-900 font-bold' : 'text-gray-500'
    }`;

  const iconButtonClass = "w-full px-2 py-3 mt-4 flex items-center justify-center text-gray-500 transition-colors duration-200";
  

  return (
    <aside className="w-20 bg-gray-100 border-r border-gray-200 flex flex-col h-full">
      <nav className="flex-1 p-4 flex flex-col gap-4">
        
        <NavLink to="/" className={getNavLinkClass}>
          <svg 
            className="w-6 h-6" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
            />
          </svg>
        </NavLink>

    
        <button
          onClick={openCreatePostModal}
          className={iconButtonClass}
          title="Create Post"
        >
          <svg 
            className="w-6 h-6" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 4v16m8-8H4" 
            />
          </svg>
        </button>
      </nav>
    </aside>
  );
};

export default SideBar;
