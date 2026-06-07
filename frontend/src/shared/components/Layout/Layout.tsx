import React from 'react';
import { Outlet, useNavigate, useMatch } from 'react-router-dom';
import { SideBar } from './SideBar';
import { GuestNav } from './GuestNav';
import Header from './Header';
import { useUIStore } from '@/shared/store/useUIStore';
import CreatePost from '@/features/posts/components/CreatePost';
import CreateMenu from '@/features/create/components/CreateMenu';
import { CanvasEditorLoader } from '@/features/canvas/components/CanvasEditorLoader';
// DECOMMISSIONED 2026-05-06: trading & messaging — see docs/RECOMMISSION_TRADING_MESSAGING.md
// import { useUnreadCount } from '@/features/messaging/index';
// import { ConversationList } from '@/features/messaging/components/ConversationList';
// import { ConversationSearch } from '@/features/messaging/components/ConversationSearch';
import { useIsAuthenticated } from '@/app/providers/AppProviders';
import { AuthWallModal } from '@/shared/components/AuthWallModal';

// Authenticated shell — only rendered when a session exists.
// Auth-dependent hooks (useUnreadCount, WebSocket state) live here and never
// fire for guests.
const AuthenticatedLayout: React.FC = () => {
  const navigate = useNavigate();
  const {
    isCreateMenuOpen, closeCreateMenu,
    openCreatePostModal, isCreatePostModalOpen, closeCreatePostModal,
    isCanvasEditorOpen, openCanvasEditor, closeCanvasEditor,
  } = useUIStore();
  // DECOMMISSIONED 2026-05-06: trading & messaging — see docs/RECOMMISSION_TRADING_MESSAGING.md
  // const unreadCount = useUnreadCount();

  // DECOMMISSIONED 2026-05-06: chat route matching disabled
  // const chatMatch = useMatch('/messages/:conversationId');
  // const isChatRoute = !!chatMatch;
  // const activeConversationId = chatMatch?.params.conversationId ?? null;
  const isLibraryRoute = !!useMatch('/library');
  const isSettingsRoute = !!useMatch('/settings');
  const isCreateFolderRoute = !!useMatch('/create-folder');
  const isFolderRoute = !!useMatch('/folders/:folderId');
  const isProfileRoute = !!useMatch('/:username');

  return (
    <div className="flex h-screen overflow-hidden">
      <SideBar unreadCount={0} isChatRoute={false} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {!isLibraryRoute && !isSettingsRoute && !isCreateFolderRoute && !isFolderRoute && !isProfileRoute && <Header />}

        <div className="flex flex-1 overflow-hidden">
          {/* DECOMMISSIONED 2026-05-06: chat-route conversation panel removed */}
          {/* {isChatRoute && (
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
          )} */}

          {isProfileRoute || isSettingsRoute ? (
            <main data-testid="main-content" className="flex-1 bg-warm-cream overflow-auto text-espresso">
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
          onSelectCatalog={() => { closeCreateMenu(); navigate('/library'); }}
          onSelectCanvas={openCanvasEditor}
          onClose={closeCreateMenu}
        />
      )}

      {isCanvasEditorOpen && <CanvasEditorLoader onClose={closeCanvasEditor} />}

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

// Guest shell — no auth-dependent hooks.
const GuestLayout: React.FC = () => (
  <div className="flex flex-col h-screen overflow-hidden">
    <GuestNav />
    <main className="flex-1 bg-warm-cream overflow-auto text-espresso">
      <Outlet />
    </main>
    <AuthWallModal />
  </div>
);

// Dispatcher — single mount point in the route tree.
// Delegates to the appropriate shell based on reactive auth state from
// AppProviders so the correct layout renders immediately after sign-in/out
// without requiring a navigation event.
const Layout: React.FC = () => {
  const isAuthenticated = useIsAuthenticated();
  return isAuthenticated ? <AuthenticatedLayout /> : <GuestLayout />;
};

export default Layout;
