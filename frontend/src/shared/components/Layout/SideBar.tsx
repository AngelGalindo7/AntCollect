import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUIStore } from '@/shared/store/useUIStore';
import { fetchWithAuth } from '@/shared/api/api';
import { ConversationList } from '@/features/messaging/components/ConversationList';
import { ConversationSearch } from '@/features/messaging/components/ConversationSearch';

const API_BASE = 'http://localhost:8000';

interface UserMe {
  username: string;
  avatar_path: string | null;
}
interface SideBarProps {
  unreadCount?: number;
}

export const SideBar: React.FC<SideBarProps> = ({ unreadCount = 0 }) => {
  const openCreatePostModal = useUIStore((state) => state.openCreatePostModal);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const navigate = useNavigate();

  const { data: me } = useQuery<UserMe>({
    queryKey: ['me'],
    queryFn: () =>
      fetchWithAuth(`${API_BASE}/users/me`).then((r) => {
        if (!r.ok) throw new Error('Failed to load user');
        return r.json();
      }),
    staleTime: 5 * 60 * 1000,
  });

  const avatarUrl = me?.avatar_path ? `${API_BASE}/${me.avatar_path}` : null;
  const initials = me ? me.username.slice(0, 2).toUpperCase() : '?';
  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full px-2 py-3 flex items-center justify-center transition-colors duration-200 ${
      isActive ? 'text-gray-900 font-bold' : 'text-gray-500'
    }`;

  const iconButtonClass = "w-full px-2 py-3 mt-4 flex items-center justify-center text-gray-500 transition-colors duration-200";
  

  return (
    <>
    <aside className="relative w-20 bg-gray-100 border-r border-gray-200 flex flex-col h-full z-20">
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
            onClick={() => setMessagesOpen((prev) => !prev)}
            className={`${iconButtonClass} ${messagesOpen ? 'text-gray-900 font-bold' : ''}`}
            title="Messages"
          >
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 16a2 2 0 01-2 2H7l-4 4V6a2 2 0 012-2h14a2 2 0 012 2v10z" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </button> 


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

        <NavLink to="/settings" className={getNavLinkClass} title="Settings">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </NavLink>

        <div className="flex-1" />

        <button
          onClick={() => me && navigate(`/${me.username}`)}
          className="w-full px-2 py-3 flex items-center justify-center"
          title={me ? `Go to your profile (@${me.username})` : 'Profile'}
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center text-white text-xs font-semibold shrink-0 ring-2 ring-transparent hover:ring-blue-400 transition-all">
            {avatarUrl ? (
              <img src={avatarUrl} alt="your profile" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
        </button>
      </nav>
    </aside>
    <div
      className={`absolute left-20 top-0 h-full bg-white border-r border-gray-200 transition-all duration-200 overflow-hidden z-10 ${
        messagesOpen ? 'w-80' : 'w-0'
      }`}
      >
     <div className="w-80 h-full flex flex-col">
    <div className="p-4 border-b border-gray-100 shrink-0">
      <h2 className="text-base font-semibold text-gray-900">Messages</h2>
    </div>
    <ConversationSearch
      onSelectConversation={(_id) => { /* open chat — TBD */ }}
    />
    <div className="flex-1 overflow-y-auto">
      <ConversationList
        onSelectConversation={(_id) => { /* open chat — TBD */ }}
      />
    </div>
  </div>
</div>
    </>
  );
};

export default SideBar;
