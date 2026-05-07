import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';
import {
  BackgroundImagePositioner,
  type BackgroundImagePosition,
} from '@/features/canvas/components/BackgroundImagePositioner';
import {
  HEADER_FRAME_WIDTH,
  HEADER_FRAME_HEIGHT,
} from '@/shared/utils/profileBackground';
import { PositionedBackgroundImage } from '@/shared/components/PositionedBackgroundImage';

interface UserMe {
  id: number;
  username: string;
  email: string;
  bio: string | null;
  avatar_path: string | null;
  background_path: string | null;
  background_offset_x: number;
  background_offset_y: number;
  background_scale: number;
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

  const [bgPositionerOpen, setBgPositionerOpen] = useState(false);
  const [bgPositionerMode, setBgPositionerMode] = useState<'upload' | 'reposition'>('upload');
  const [pendingBgFile, setPendingBgFile] = useState<File | null>(null);
  const [pendingBgUrl, setPendingBgUrl] = useState<string | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);

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

  const backgroundUploadMutation = useMutation({
    mutationFn: ({ file, pos }: { file: File; pos: BackgroundImagePosition }) => {
      const form = new FormData();
      form.append('file', file);
      form.append('offset_x', String(pos.offsetX));
      form.append('offset_y', String(pos.offsetY));
      form.append('scale', String(pos.scale));
      return fetchWithAuth(`${API_BASE}/users/me/background`, { method: 'POST', body: form }).then(
        async (r) => {
          if (!r.ok) throw new Error('Background upload failed');
          return r.json();
        }
      );
    },
    onSuccess: () => {
      setBgError(null);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => setBgError('Background upload failed. Try again.'),
  });

  const backgroundPositionMutation = useMutation({
    mutationFn: (pos: BackgroundImagePosition) =>
      fetchWithAuth(`${API_BASE}/users/me/background-position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offset_x: pos.offsetX, offset_y: pos.offsetY, scale: pos.scale }),
      }).then(async (r) => {
        if (!r.ok) throw new Error('Reposition failed');
        return r.json();
      }),
    onSuccess: () => {
      setBgError(null);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => setBgError('Reposition failed. Try again.'),
  });

  const handleBackgroundFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBgError(null);
    if (pendingBgUrl && pendingBgUrl.startsWith('blob:')) URL.revokeObjectURL(pendingBgUrl);
    setPendingBgFile(file);
    setPendingBgUrl(URL.createObjectURL(file));
    setBgPositionerMode('upload');
    setBgPositionerOpen(true);
  };

  const handleBackgroundReposition = () => {
    if (!user?.background_path) return;
    setBgError(null);
    setPendingBgFile(null);
    setPendingBgUrl(user.background_path);
    setBgPositionerMode('reposition');
    setBgPositionerOpen(true);
  };

  const handleBackgroundPositionApply = (pos: BackgroundImagePosition) => {
    setBgPositionerOpen(false);
    if (bgPositionerMode === 'upload' && pendingBgFile) {
      backgroundUploadMutation.mutate({ file: pendingBgFile, pos });
    } else if (bgPositionerMode === 'reposition') {
      backgroundPositionMutation.mutate(pos);
    }
    if (pendingBgUrl && pendingBgUrl.startsWith('blob:')) URL.revokeObjectURL(pendingBgUrl);
    setPendingBgFile(null);
    setPendingBgUrl(null);
  };

  const handleBackgroundPositionCancel = () => {
    setBgPositionerOpen(false);
    if (pendingBgUrl && pendingBgUrl.startsWith('blob:')) URL.revokeObjectURL(pendingBgUrl);
    setPendingBgFile(null);
    setPendingBgUrl(null);
  };

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
        <div className="relative w-full aspect-[6/1] rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
          {user.background_path ? (
            <PositionedBackgroundImage
              src={user.background_path}
              offsetX={user.background_offset_x}
              offsetY={user.background_offset_y}
              scale={user.background_scale}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
              No background set
            </div>
          )}
          <div className="absolute bottom-2 right-2 z-10 flex gap-2">
            {user.background_path && (
              <button
                onClick={handleBackgroundReposition}
                className="bg-white/90 hover:bg-white text-sm text-gray-700 font-medium px-3 py-1 rounded-md border border-gray-200 transition-colors"
              >
                {backgroundPositionMutation.isPending ? 'Saving…' : 'Reposition'}
              </button>
            )}
            <button
              onClick={() => bgFileInputRef.current?.click()}
              className="bg-white/90 hover:bg-white text-sm text-gray-700 font-medium px-3 py-1 rounded-md border border-gray-200 transition-colors"
            >
              {backgroundUploadMutation.isPending
                ? 'Uploading…'
                : user.background_path
                ? 'Change'
                : 'Upload'}
            </button>
          </div>
        </div>
        <input
          ref={bgFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBackgroundFileChange}
        />
        {bgError && <p className="mt-2 text-xs text-red-500">{bgError}</p>}
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

      {bgPositionerOpen && pendingBgUrl && (
        <BackgroundImagePositioner
          imageUrl={pendingBgUrl}
          frameWidth={HEADER_FRAME_WIDTH}
          frameHeight={HEADER_FRAME_HEIGHT}
          initial={
            bgPositionerMode === 'reposition'
              ? {
                  offsetX: user.background_offset_x,
                  offsetY: user.background_offset_y,
                  scale: user.background_scale,
                }
              : undefined
          }
          title={bgPositionerMode === 'reposition' ? 'Reposition background' : 'Position profile background'}
          onCancel={handleBackgroundPositionCancel}
          onApply={handleBackgroundPositionApply}
        />
      )}
    </div>
  );
}
