import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConversationStore } from '../store/conversationStore';
import { ConversationCell } from './ConversationCell';
import { ConversationSearch } from './ConversationSearch';

const API_BASE = import.meta.env.VITE_API_URL;
console.log('API_BASE:', API_BASE);
interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationList({ onSelectConversation }: ConversationListProps) {
  const conversations = useConversationStore((s) => s.conversations);
  const setConversations = useConversationStore((s) => s.setConversations);

  const {data, isLoading, isError } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/conversations`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return res.json();
    }, 
  });
  useEffect(() => {
  if (data) {
    setConversations(data); // data is already the array
  }
}, [data]);

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

  if (conversations.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {conversations.map((c) => (
        <ConversationCell
          key={c.id}
          conversation={c}
          onClick={() => onSelectConversation(c.id)}
        />
      ))}
    </div>
  );
}

export default ConversationList;

