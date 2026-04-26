import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';

interface UserMe {
  id: number;
  username: string;
  email: string;
  bio: string | null;
  avatar_path: string | null;
  background_path: string | null;
}

function fetchMe(): Promise<UserMe> {
  return fetchWithAuth(`${API_BASE}/users/me`).then((r) => {
    if (!r.ok) throw new Error('Failed to load profile');
    return r.json();
  });
}

export default function ProfileTab() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Initialise fields once data loads
  const [initialised, setInitialised] = useState(false);
  if (user && !initialised) {
    setUsername(user.username);
    setBio(user.bio ?? '');
    setInitialised(true);
  }

  const profileMutation = useMutation({
    mutationFn: () =>
      fetchWithAuth(`${API_BASE}/users/me/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username !== user?.username ? username : undefined,
          bio: bio !== (user?.bio ?? '') ? bio : undefined,
        }),
      }).then(async (r) => {
        if (r.status === 409) throw new Error('Username already taken');
        if (!r.ok) throw new Error('Failed to save profile');
        return r.json() as Promise<UserMe>;
      }),
    onSuccess: (updated) => {
      if (updated.username !== localStorage.getItem('username')) {
        localStorage.setItem('username', updated.username);
      }
      queryClient.setQueryData(['me'], updated);
      setUsernameError('');
    },
    onError: (err: Error) => {
      if (err.message === 'Username already taken') setUsernameError(err.message);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return fetchWithAuth(`${API_BASE}/users/me/avatar`, { method: 'POST', body: form }).then(
        async (r) => {
          if (!r.ok) throw new Error('Avatar upload failed');
          return r.json();
        }
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  const backgroundMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return fetchWithAuth(`${API_BASE}/users/me/background`, { method: 'POST', body: form }).then(
        async (r) => {
          if (!r.ok) throw new Error('Background upload failed');
          return r.json();
        }
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!user) return null;

  const avatarUrl = user.avatar_path ?? null;
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-16 h-16 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center text-white font-semibold text-lg shrink-0 hover:opacity-80 transition-opacity"
          title="Change photo"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-sm text-blue-500 hover:text-blue-600 font-medium"
        >
          {avatarMutation.isPending ? 'Uploading…' : 'Change photo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) avatarMutation.mutate(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Background image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Profile Background</label>
        <div className="relative w-full h-28 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
          {user.background_path ? (
            <img src={user.background_path} alt="background" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">
              No background set
            </div>
          )}
          <button
            onClick={() => bgFileInputRef.current?.click()}
            className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-sm text-gray-700 font-medium px-3 py-1 rounded-md border border-gray-200 transition-colors"
          >
            {backgroundMutation.isPending ? 'Uploading…' : user.background_path ? 'Change' : 'Upload'}
          </button>
        </div>
        <input
          ref={bgFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) backgroundMutation.mutate(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setUsernameError(''); }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {usernameError && <p className="mt-1 text-xs text-red-500">{usernameError}</p>}
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bio
          <span className="float-right text-gray-400 font-normal">{bio.length}/160</span>
        </label>
        <textarea
          value={bio}
          maxLength={160}
          rows={3}
          onChange={(e) => setBio(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {profileMutation.isError && !(usernameError) && (
        <p className="text-sm text-red-500">Failed to save. Please try again.</p>
      )}

      <button
        onClick={() => profileMutation.mutate()}
        disabled={profileMutation.isPending}
        className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {profileMutation.isPending ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
