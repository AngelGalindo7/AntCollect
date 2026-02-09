import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import CreatePost from './CreatePost';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);

  const handleNavigateHome = () => {
    navigate('/Home');
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-20 bg-gray-100 text-gray-700 flex flex-col">
        
        
        <nav className="flex-1 p-4">
          <button
            onClick={handleNavigateHome}
            className="w-full px-2 py-3 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center"
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
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
              />
            </svg>
          </button>


          <button 
            onClick={() => setIsCreatePostOpen(true)}
            className="w-full px-2 py-3 mt-4 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center"
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

      {/* Main content area */}
      <main className="flex-1 bg-gray-100 overflow-auto">
        <Outlet /> {/* This renders your page components */}
      </main>

      {/* Create Post Modal Overlay */}
      {isCreatePostOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="relative">
            {/* Close button */}
            <button
              onClick={() => setIsCreatePostOpen(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl font-bold"
            >
              ✕
            </button>
            
            {/* Your CreatePost component */}
            <CreatePost onSuccess={() => setIsCreatePostOpen(false)} />
          </div>
        </div>
      )}


    </div>
  );
};

export default Layout;