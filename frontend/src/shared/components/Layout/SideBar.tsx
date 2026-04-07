import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useUIStore } from '@/shared/store/useUIStore';
import { fetchWithAuth } from '@/shared/api/api';
import { ConversationList } from '@/features/messaging/components/ConversationList';
import { ConversationSearch } from '@/features/messaging/components/ConversationSearch';
import { useWebSocketContext } from '@/features/messaging/providers/WebSocketProvider';
import { useTradeRequestStore } from '@/features/trading/store/tradeRequestStore';
import {
  getTradeInboxCount,
  getTradeInbox,
  acceptTradeRequest,
  declineTradeRequest,
} from '@/features/trading/api/tradeRequestApi';
import type { TradeRequest } from '@/features/trading/types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const MESSAGING_URL = import.meta.env.VITE_API_URL;

interface UserMe {
  username: string;
  avatar_path: string | null;
}

interface SideBarProps {
  unreadCount?: number;
  /** True when Layout has already rendered the inline conversation panel. */
  isChatRoute?: boolean;
}

export const SideBar: React.FC<SideBarProps> = ({ unreadCount = 0, isChatRoute = false }) => {
  const openCreateMenu = useUIStore((state) => state.openCreateMenu);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [tradeRequestsOpen, setTradeRequestsOpen] = useState(false);
  const navigate = useNavigate();

  const { sendMessage } = useWebSocketContext();

  const { pendingRequests, pendingCount, setPendingRequests, setPendingCount, removeRequest } =
    useTradeRequestStore();

  const { data: me } = useQuery<UserMe>({
    queryKey: ['me'],
    queryFn: () =>
      fetchWithAuth(`${BACKEND_URL}/users/me`).then((r) => {
        if (!r.ok) throw new Error('Failed to load user');
        return r.json();
      }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: tradeCount = 0 } = useQuery<number>({
    queryKey: ['trade-requests', 'inbox-count'],
    queryFn: getTradeInboxCount,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  React.useEffect(() => {
    setPendingCount(tradeCount);
  }, [tradeCount, setPendingCount]);

  const handleOpenTradePanel = async () => {
    const opening = !tradeRequestsOpen;
    setTradeRequestsOpen(opening);
    setMessagesOpen(false);
    if (opening) {
      try {
        const inbox = await getTradeInbox();
        setPendingRequests(inbox);
      } catch {
        // panel shows empty list on failure
      }
    }
  };

  const handleAccept = async (tradeRequest: TradeRequest) => {
    try {
      const accepted = await acceptTradeRequest(tradeRequest.id);

      const convRes = await fetchWithAuth(`${MESSAGING_URL}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [accepted.requester_id, accepted.recipient_id],
          isGroup: false,
          groupName: null,
        }),
      });

      const conversation = await convRes.json();
      const conversationId: string = String(conversation.conversationId ?? conversation.id);

      const clientMessageId = crypto.randomUUID();
      sendMessage(
        conversationId,
        JSON.stringify({
          type: accepted.request_type,
          targetPostId: accepted.target_post_id,
          postCaption: accepted.post_caption,
          postThumbnail: accepted.post_thumbnail,
          offeredFolderId: accepted.offered_folder_id,
          offeredFolderName: accepted.offered_folder_name,
          requesterUsername: accepted.requester_username,
          recipientUsername: me?.username,
        }),
        clientMessageId,
        'trade_context',
      );

      removeRequest(tradeRequest.id);
      navigate(`/messages/${conversationId}`);
    } catch (err) {
      console.error('[Trade] Accept failed', err);
    }
  };

  const handleDecline = async (tradeRequest: TradeRequest) => {
    try {
      await declineTradeRequest(tradeRequest.id);
      removeRequest(tradeRequest.id);
    } catch (err) {
      console.error('[Trade] Decline failed', err);
    }
  };

  const avatarUrl = me?.avatar_path ? `${BACKEND_URL}/${me.avatar_path}` : null;
  const initials = me ? me.username.slice(0, 2).toUpperCase() : '?';

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full px-2 py-3 flex items-center justify-center transition-colors duration-200 ${
      isActive ? 'text-gray-900 font-bold' : 'text-gray-500'
    }`;

  const iconButtonClass = 'w-full px-2 py-3 mt-4 flex items-center justify-center text-gray-500 transition-colors duration-200';

  const messagesActive = isChatRoute || messagesOpen;

  const wantToTrade = pendingRequests.filter((r) => r.request_type === 'WANT_TO_TRADE');
  const hasWhatYouNeed = pendingRequests.filter((r) => r.request_type === 'HAVE_WHAT_YOU_NEED');

  return (
    <>
      <aside className="relative w-20 bg-gray-100 border-r border-gray-200 flex flex-col h-full z-20">
        <nav className="flex-1 p-4 flex flex-col gap-4">

          <NavLink to="/" className={getNavLinkClass}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </NavLink>

          <button
            onClick={isChatRoute ? undefined : () => { setMessagesOpen((prev) => !prev); setTradeRequestsOpen(false); }}
            className={`${iconButtonClass} ${messagesActive ? 'text-gray-900 font-bold' : ''}`}
            title="Messages"
          >
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 16a2 2 0 01-2 2H7l-4 4V6a2 2 0 012-2h14a2 2 0 012 2v10z" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </button>

          {/* Trade requests icon */}
          <button
            onClick={handleOpenTradePanel}
            className={`${iconButtonClass} ${tradeRequestsOpen ? 'text-gray-900 font-bold' : ''}`}
            title="Trade Requests"
          >
            <div className="relative">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white leading-none">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </div>
          </button>

          <button onClick={openCreateMenu} className={iconButtonClass} title="Create">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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

      {/* Messages slide-out panel — only shown on non-chat routes */}
      {!isChatRoute && (
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
              onSelectConversation={(id) => { navigate(`/messages/${id}`); setMessagesOpen(false); }}
            />
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                onSelectConversation={(id) => { navigate(`/messages/${id}`); setMessagesOpen(false); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Trade requests slide-out panel */}
      <div
        className={`absolute left-20 top-0 h-full bg-white border-r border-gray-200 transition-all duration-200 overflow-hidden z-10 ${
          tradeRequestsOpen ? 'w-80' : 'w-0'
        }`}
      >
        <div className="w-80 h-full flex flex-col">
          <div className="p-4 border-b border-gray-100 shrink-0 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Trade Requests</h2>
            {pendingCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white leading-none">
                {pendingCount}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {pendingRequests.length === 0 && (
              <p className="text-sm text-gray-400 text-center mt-8">No pending trade requests</p>
            )}

            {wantToTrade.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Wants Your Stickers
                </h3>
                <div className="space-y-2">
                  {wantToTrade.map((req) => (
                    <TradeRequestCard
                      key={req.id}
                      request={req}
                      onAccept={handleAccept}
                      onDecline={handleDecline}
                    />
                  ))}
                </div>
              </section>
            )}

            {hasWhatYouNeed.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Has What You Need
                </h3>
                <div className="space-y-2">
                  {hasWhatYouNeed.map((req) => (
                    <TradeRequestCard
                      key={req.id}
                      request={req}
                      onAccept={handleAccept}
                      onDecline={handleDecline}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ── TradeRequestCard ──────────────────────────────────────────────────────────

interface TradeRequestCardProps {
  request: TradeRequest;
  onAccept: (r: TradeRequest) => void;
  onDecline: (r: TradeRequest) => void;
}

function TradeRequestCard({ request, onAccept, onDecline }: TradeRequestCardProps) {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const thumbnailUrl = request.post_thumbnail ? `${BACKEND_URL}/${request.post_thumbnail}` : null;
  const avatarUrl = request.requester_avatar ? `${BACKEND_URL}/${request.requester_avatar}` : null;

  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 text-sm space-y-2">
      {/* Requester */}
      <a
        href={`/${request.requester_username}`}
        className="flex items-center gap-2 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-6 h-6 rounded-full overflow-hidden bg-blue-400 flex items-center justify-center text-white text-xs font-semibold shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={request.requester_username} className="w-full h-full object-cover" />
          ) : (
            request.requester_username.charAt(0).toUpperCase()
          )}
        </div>
        <span className="font-medium text-gray-800">@{request.requester_username}</span>
      </a>

      {/* Post */}
      <div className="flex items-center gap-2">
        {thumbnailUrl && (
          <img src={thumbnailUrl} alt={request.post_caption} className="w-10 h-10 rounded object-cover shrink-0" />
        )}
        <span className="text-gray-700 line-clamp-2">{request.post_caption}</span>
      </div>

      {/* Offered folder */}
      {request.offered_folder_id && request.offered_folder_name && (
        <p className="text-xs text-gray-500">
          Offering:{' '}
          <a href={`/folders/${request.offered_folder_id}`} className="text-blue-500 hover:underline">
            {request.offered_folder_name}
          </a>
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onAccept(request)}
          className="flex-1 rounded bg-blue-500 text-white text-xs font-semibold py-1 hover:bg-blue-600 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={() => onDecline(request)}
          className="flex-1 rounded bg-gray-200 text-gray-700 text-xs font-semibold py-1 hover:bg-gray-300 transition-colors"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

export default SideBar;
