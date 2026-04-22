import React from 'react';
import { Outlet, useNavigate, useMatch } from 'react-router-dom';
import { SideBar } from './SideBar';
import Header from './Header';
import { useUIStore } from '@/shared/store/useUIStore';
import CreatePost from '@/features/posts/components/CreatePost';
import CreateMenu from '@/features/create/components/CreateMenu';
import { useUnreadCount } from '@/features/messaging/index';
import { ConversationList } from '@/features/messaging/components/ConversationList';
import { ConversationSearch } from '@/features/messaging/components/ConversationSearch';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { isCreateMenuOpen, closeCreateMenu, openCreatePostModal, isCreatePostModalOpen, closeCreatePostModal } = useUIStore();
  const unreadCount = useUnreadCount();

  const chatMatch = useMatch('/messages/:conversationId');
  const isChatRoute = !!chatMatch;
  const activeConversationId = chatMatch?.params.conversationId ?? null;
  const isLibraryRoute = !!useMatch('/library');
  const isSettingsRoute = !!useMatch('/settings');

  return (
    <div className="flex h-screen overflow-hidden">
      <SideBar unreadCount={unreadCount} isChatRoute={isChatRoute} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {!isChatRoute && !isLibraryRoute && !isSettingsRoute && <Header />}
        
        <div className="flex flex-1 overflow-hidden">
          {/* Conversation panel — pinned inline on chat routes, hidden otherwise */}
        {isChatRoute && (
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shrink-0">
            <div className="p-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Messages</h2>
            </div>
            <ConversationSearch
              onSelectConversation={(id) => navigate(`/messages/${id}`)}
            />
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                onSelectConversation={(id) => navigate(`/messages/${id}`)}
                activeConversationId={activeConversationId}
              />
            </div>
          </div>
        )}

        {/* Main content area */}
        {isChatRoute ? (
          <main data-testid="main-content" className="flex-1 overflow-hidden bg-warm-cream">
            <Outlet />
          </main>
        ) : (
          <main data-testid="main-content" className="flex-1 bg-warm-cream overflow-auto text-espresso">
            <div className="max-w-7xl mx-auto p-4">
              <Outlet />
            </div>
          </main>
        )}
      </div>
    </div>

    {isCreateMenuOpen && (
        <CreateMenu
          onSelectPost={openCreatePostModal}
          onSelectFolder={() => { closeCreateMenu(); navigate('/create-folder'); }}
          onClose={closeCreateMenu}
        />
      )}

      {isCreatePostModalOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={closeCreatePostModal}
        >
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeCreatePostModal}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl font-bold"
            >
              ✕
            </button>
            <CreatePost onSuccess={closeCreatePostModal} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
