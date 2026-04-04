import React from 'react';
import { Outlet } from 'react-router-dom';
import { SideBar } from './SideBar';
import { useUIStore } from '@/shared/store/useUIStore';
import CreatePost from '@/features/posts/components/CreatePost';
import { useUnreadCount } from '@/features/messaging/index';

const Layout: React.FC = () => {
  //const navigate = useNavigate();
  //const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const { isCreatePostModalOpen, closeCreatePostModal } = useUIStore();
  //const handleNavigateHome = () => {
  //  navigate('/Home');
  //};
  const unreadCount = useUnreadCount();
  return (
    <div className="flex h-screen overflow-hidden">
      

      <SideBar unreadCount={unreadCount} />

      {/* Main content area */}
      <main className="flex-1 bg-gray-100 overflow-auto">
        <div className="max-w-screen-xl mx-auto p-4">
          <Outlet />
        </div>
      </main>

      {/* Create Post Modal Overlay */}
      {isCreatePostModalOpen && (

        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={closeCreatePostModal}    
        >
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeCreatePostModal} 
                className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl font-bold"
            >
              ✕
            </button>
            
            {/* Your CreatePost component */}
            <CreatePost onSuccess={closeCreatePostModal} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
