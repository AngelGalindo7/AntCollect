import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConversationStore } from '../store/conversationStore';
import { ConversationCell } from './ConversationCell';
import { fetchWithAuth } from '@/shared/api/api';

const API_BASE = import.meta.env.VITE_API_URL;

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void;
  activeConversationId?: string | null;
}

export function ConversationList({ onSelectConversation, activeConversationId }: ConversationListProps) {
  const conversations = useConversationStore((s) => s.conversations);
  const setConversations = useConversationStore((s) => s.setConversations);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await fetchWithAuth(`${API_BASE}/conversations`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return res.json();
    },
  });

  useEffect(() => {
    if (data) setConversations(data);
  }, [data, setConversations]);

  if (isLoading) {
    return (
      <div className="flex flex-col">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <p className="text-sm text-gray-400">Couldn't load conversations</p>
      </div>
    );
  }

  // Prefer the Zustand store (contains real-time WebSocket upserts + locally created
  // conversations). Fall back to the raw query data to avoid an empty-state flash:
  // useEffect seeds the store AFTER render, so on the first render after a successful
  // fetch, conversations === [] even though data has arrived. Using data as the fallback
  // prevents "No conversations yet" from flashing before the store is seeded.
  const displayList = conversations.length > 0 ? conversations : (data ?? []);

  if (displayList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 px-6 text-center">
        <p className="text-sm text-gray-400">No conversations yet.</p>
        <p className="text-xs text-gray-400">Search for a person above to start one.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {displayList.map((c) => (
        <ConversationCell
          key={c.conversationId}
          conversation={c}
          isActive={c.conversationId === activeConversationId}
          onClick={() => onSelectConversation(c.conversationId)}
        />
      ))}
    </div>
  );
}

export default ConversationList;
