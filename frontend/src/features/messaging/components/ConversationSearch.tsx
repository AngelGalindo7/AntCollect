import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConversationStore } from '../store/conversationStore';
import { fetchWithAuth } from '@/shared/api/api';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;   // FastAPI :8000
const API_BASE    = import.meta.env.VITE_API_URL ?? "http://localhost:8080"; // messaging service :8080
interface UserResult {
  id: number;
  username: string;
  avatar_path?: string;
}

interface ConversationSearchProps {
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationSearch({ onSelectConversation }: ConversationSearchProps) {
  const [query, setQuery] = useState('');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  const conversations = useConversationStore((s) => s.conversations);

  const matchedConversations = query.trim()
    ? conversations.filter((c) =>
        (c.isGroup ? c.groupName : c.participantName)
          ?.toLowerCase()
          .includes(query.toLowerCase())
      )
    : [];

  useEffect(() => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    if (!query.trim()) {
      setUserResults([]);
      return;
    }

    debounceTimeout.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetchWithAuth(`${BACKEND_URL}/users/search_user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query, search_type: 'quick' }),
        });
        if (res.ok) {
          const data = await res.json();
          setUserResults(data.users ?? []);
        }
      } catch {
        setUserResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, [query]);

  function handleClear() {
    setQuery('');
    setUserResults([]);
    setCreateError(false);
    setCreating(false);
  }
  const upsertConversation = useConversationStore((s) => s.upsertConversation);

  async function handleSelectUser(user: UserResult) {
    if (creating) return;
    setCreateError(false);

    const existing = useConversationStore.getState().conversations.find(
      (c) => !c.isGroup && c.participantId === String(user.id)
    );

    if (existing) {
      onSelectConversation(existing.conversationId);
      handleClear();
      return;
    }

    setCreating(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userIds: [user.id], isGroup: false, groupName: null }),
      });

      if (res.status === 409) {
        // Conversation already exists — extract its id from the error body and navigate
        const body = await res.json();
        const existingId = String(body.message).split(': ')[1];
        if (!existingId) throw new Error('409 body missing conversation id');
        onSelectConversation(existingId);
        handleClear();
        return;
      }

      if (!res.ok) throw new Error(`Failed to create conversation: ${res.status}`);

      const data = await res.json();
      upsertConversation(data);
      // Invalidate so the ConversationList refetches fresh data when it next mounts.
      // Without this, the stale TanStack cache (pre-creation) overwrites the upserted
      // conversation when the inline panel's ConversationList mounts after navigation.
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onSelectConversation(data.conversationId);
      handleClear();
    } catch (err) {
      console.error('Failed to create conversation', err);
      setCreating(false);
      setCreateError(true);
    }
  }

  const showResults = query.trim().length > 0;

  return (
    <div className="relative p-3 border-b border-gray-100">
      <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-2">
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages or people"
          className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400"
        />
        {query && (
          <button onClick={handleClear} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {createError && (
        <p className="mt-1 text-xs text-red-500 px-1">Couldn't open conversation. Try again.</p>
      )}

      {showResults && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 z-30 overflow-hidden">

          {matchedConversations.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Conversations
              </p>
              {matchedConversations.map((c) => {
                const name = (c.isGroup ? c.groupName : c.participantName) ?? '?';
                const avatar = c.isGroup ? c.groupAvatar : c.participantAvatar;
                return (
                  <button
                    key={c.conversationId}
                    onClick={() => { onSelectConversation(c.conversationId); handleClear(); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                  >
                    {avatar ? (
                      <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-200" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-gray-800">{name}</span>
                  </button>
                );
              })}
            </>
          )}

          {userResults.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                People
              </p>
              {userResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  disabled={creating}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {u.avatar_path ? (
                    <img
                      src={u.avatar_path}
                      alt={u.username}
                      className="w-8 h-8 rounded-full object-cover bg-gray-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-gray-800">{u.username}</span>
                  {creating && <span className="ml-auto text-xs text-gray-400">Opening…</span>}
                </button>
              ))}
            </>
          )}

          {loading && (
            <p className="px-3 py-2 text-sm text-gray-400">Searching...</p>
          )}

          {!loading && matchedConversations.length === 0 && userResults.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">No results for "{query}"</p>
          )}

        </div>
      )}
    </div>
  );
}
