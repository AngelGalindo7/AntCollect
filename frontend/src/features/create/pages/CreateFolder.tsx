import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '@/shared/api/api';
import type { FolderType, Post } from '@/shared/types/Types';

const FOLDER_TYPES: { value: FolderType; label: string; hint: string }[] = [
  { value: 'collection', label: 'Collection',   hint: 'Stickers you own' },
  { value: 'looking_for', label: 'Looking For', hint: 'Wishlist'          },
  { value: 'trading',    label: 'Trading Away', hint: 'Open to swap'     },
];

const MAX_UPLOAD_FILES = 20;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

import { API_BASE } from '@/shared/api/api';

const CreateFolder: React.FC = () => {
  const navigate = useNavigate();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [name, setName]           = useState('');
  const [folderType, setFolderType] = useState<FolderType>('collection');
  const [posts, setPosts]         = useState<Post[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [savingProgress, setSavingProgress] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const [avatarFile, setAvatarFile]       = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [uploadFiles, setUploadFiles]     = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  useEffect(() => {
    return () => { uploadPreviews.forEach(URL.revokeObjectURL); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoadingPosts(true);
      try {
        let username = localStorage.getItem('username');
        if (!username) {
          const meRes = await fetchWithAuth(`${API_BASE}/users/me`, { credentials: 'include' });
          if (!meRes.ok) throw new Error('Not authenticated');
          const me = await meRes.json();
          username = me.username;
        }
        const res = await fetchWithAuth(`${API_BASE}/users/get_user_`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username }),
        });
        if (!res.ok) throw new Error('Failed to load posts');
        const data = await res.json();
        const transformed: Post[] = (data.posts ?? []).map((post: any) => ({
          ...post,
          image_paths: post.images?.filter((img: any) => img?.paths?.medium).map((img: any) => img.paths.original) ?? [],
        }));
        setPosts(transformed);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPosts(false);
      }
    };
    fetchPosts();
    nameInputRef.current?.focus();
  }, []);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUploadFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming  = Array.from(e.target.files);
    const valid     = incoming.filter(f => f.type.startsWith('image/'));
    const room      = MAX_UPLOAD_FILES - uploadFiles.length;
    const accepted  = valid.slice(0, Math.max(room, 0));
    if (accepted.length < incoming.length) {
      setUploadWarning(valid.length < incoming.length
        ? 'Some files were skipped — only images are allowed.'
        : `Limit is ${MAX_UPLOAD_FILES} images.`);
    } else {
      setUploadWarning(null);
    }
    setUploadFiles(prev => [...prev, ...accepted]);
    setUploadPreviews(prev => [...prev, ...accepted.map(f => URL.createObjectURL(f))]);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const removeUploadAt = (idx: number) => {
    URL.revokeObjectURL(uploadPreviews[idx]);
    setUploadFiles(prev => prev.filter((_, i) => i !== idx));
    setUploadPreviews(prev => prev.filter((_, i) => i !== idx));
    setUploadWarning(null);
  };

  const togglePost = (postId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter a folder name.'); nameInputRef.current?.focus(); return; }

    setSaving(true); setSavingProgress(null); setError(null);
    let folder: { id: number } | null = null;
    const uploadedPostIds: number[] = [];

    try {
      const createRes = await fetchWithAuth(`${API_BASE}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmed, description: null, is_public: true, folder_type: folderType }),
      });
      if (!createRes.ok) throw new Error('Failed to create folder.');
      folder = await createRes.json();

      if (avatarFile) {
        const fd = new FormData(); fd.append('file', avatarFile);
        await fetchWithAuth(`${API_BASE}/folders/${folder!.id}/avatar`, { method: 'POST', credentials: 'include', body: fd });
      }

      for (let i = 0; i < uploadFiles.length; i++) {
        setSavingProgress(`Uploading sticker ${i + 1} of ${uploadFiles.length}…`);
        const fd = new FormData(); fd.append('files', uploadFiles[i]); fd.append('is_published', 'true');
        const uploadRes = await fetchWithAuth(`${API_BASE}/folders/${folder!.id}/upload`, { method: 'POST', credentials: 'include', body: fd });
        if (!uploadRes.ok) throw new Error(uploadRes.status === 429 ? 'Upload limit reached.' : `Sticker ${i + 1} failed.`);
        const body = await uploadRes.json();
        const id = body?.post_ids?.[0];
        if (typeof id === 'number') uploadedPostIds.push(id);
      }

      setSavingProgress(null);
      for (const postId of selectedIds) {
        await fetchWithAuth(`${API_BASE}/folders/${folder!.id}/posts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ post_id: postId }),
        });
      }

      const username = localStorage.getItem('username');
      navigate(username ? `/${username}` : '/');
    } catch (err) {
      setSavingProgress(uploadedPostIds.length ? 'Rolling back…' : null);
      for (const postId of uploadedPostIds) {
        try { await fetchWithAuth(`${API_BASE}/posts/${postId}`, { method: 'DELETE', credentials: 'include' }); }
        catch (e) { console.error('Rollback failed for post', postId, e); }
      }
      if (folder) {
        try { await fetchWithAuth(`${API_BASE}/folders/${folder.id}`, { method: 'DELETE', credentials: 'include' }); }
        catch (e) { console.error('Rollback failed for folder', folder.id, e); }
      }
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false); setSavingProgress(null);
    }
  };

  const totalToAdd = uploadFiles.length + selectedIds.size;
  const activeType = FOLDER_TYPES.find(ft => ft.value === folderType)!;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-warm-cream">

      {/* ── Top nav bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-espresso/50 hover:text-espresso transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-3">
          {saving && savingProgress && <span className="text-xs text-espresso/45 italic">{savingProgress}</span>}
          {error && <p className="text-sm text-brick-red">{error}</p>}
          <button onClick={() => navigate(-1)} disabled={saving} className="text-sm font-medium text-espresso/50 hover:text-espresso transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold bg-campus-blue text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {saving && (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
              </svg>
            )}
            {saving ? 'Saving…' : 'Create Folder'}
          </button>
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div
        className="px-8 pt-6 pb-10 flex items-end gap-7 shrink-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,100,164,0.12) 0%, #F4EFE6 100%)' }}
      >
        {/* Cover art */}
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className="w-44 h-44 shrink-0 shadow-xl overflow-hidden rounded-xl bg-white/60 flex items-center justify-center group transition-all hover:shadow-2xl"
          aria-label="Choose folder cover"
        >
          {avatarPreview ? (
            <>
              <img src={avatarPreview} alt="cover" className="w-full h-full object-cover" />
              <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l-3 3v3h3l9-9-3-3-9 9z" />
                </svg>
              </span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-2 text-espresso/25 group-hover:text-espresso/45 transition-colors pointer-events-none">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-medium">Add cover</span>
            </span>
          )}
        </button>
        <input ref={avatarInputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleAvatarSelect} />

        {/* Title area */}
        <div className="flex-1 min-w-0 pb-1">
          {/* Type chips */}
          <div className="flex gap-2 mb-4">
            {FOLDER_TYPES.map(ft => (
              <button
                key={ft.value}
                type="button"
                onClick={() => setFolderType(ft.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  folderType === ft.value
                    ? 'bg-campus-blue text-white shadow-sm'
                    : 'bg-espresso/8 text-espresso/55 hover:bg-espresso/12'
                }`}
              >
                {ft.label}
              </button>
            ))}
          </div>

          {/* Big editable name */}
          <input
            ref={nameInputRef}
            type="text"
            placeholder="My Folder"
            value={name}
            onChange={e => { setName(e.target.value); setError(null); }}
            maxLength={80}
            className="w-full bg-transparent text-4xl font-bold text-espresso outline-none placeholder-espresso/20 border-b-2 border-transparent hover:border-espresso/15 focus:border-campus-blue transition-colors pb-1"
          />

          {/* Meta line */}
          <p className="text-sm text-espresso/45 mt-3">
            {activeType.hint}
            {totalToAdd > 0 && <span> · {totalToAdd} sticker{totalToAdd === 1 ? '' : 's'} ready</span>}
          </p>
        </div>
      </div>

      {/* ── Action strip ────────────────────────────────────────── */}
      <div className="px-8 py-4 flex items-center gap-3 border-b border-warm-gray/20 bg-white/70 backdrop-blur-sm shrink-0">
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-warm-gray/60 text-sm font-semibold text-espresso/65 cursor-pointer hover:border-espresso/40 hover:text-espresso transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload stickers
          <input ref={uploadInputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={handleUploadFilesChange} />
        </label>

        {uploadFiles.length > 0 && (
          <span className="text-xs text-espresso/40 ml-1">{uploadFiles.length}/{MAX_UPLOAD_FILES}</span>
        )}

        {selectedIds.size > 0 && (
          <span className="text-xs font-semibold text-campus-blue bg-campus-blue/10 px-2.5 py-1 rounded-full ml-1">
            {selectedIds.size} from collection
          </span>
        )}

        {uploadWarning && (
          <span className="text-xs text-brick-red ml-2">{uploadWarning}</span>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

        {/* Uploaded previews */}
        {uploadPreviews.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-espresso/40 uppercase tracking-wide mb-3">Uploaded</p>
            <div className="flex flex-wrap gap-3">
              {uploadPreviews.map((src, i) => (
                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden shadow-sm group/thumb">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeUploadAt(i)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-espresso/75 text-white text-xs flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-brick-red"
                    aria-label="Remove"
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing posts */}
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-xs font-semibold text-espresso/40 uppercase tracking-wide">
              Add from your collection
            </p>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-espresso/40 hover:text-espresso transition-colors"
              >
                Clear selection
              </button>
            )}
          </div>

          {loadingPosts ? (
            <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="aspect-square bg-warm-gray/20 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-warm-gray/40 rounded-xl">
              <svg className="w-9 h-9 text-espresso/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-espresso/40">No posts yet — upload some above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {posts.map(post => {
                const selected = selectedIds.has(post.post_id);
                const thumb    = post.image_paths[0];
                return (
                  <button
                    key={post.post_id}
                    onClick={() => togglePost(post.post_id)}
                    className={`relative aspect-square overflow-hidden rounded-lg transition-all ${
                      selected
                        ? 'ring-2 ring-campus-blue ring-offset-2 ring-offset-warm-cream scale-[0.96]'
                        : 'hover:scale-[1.03] hover:shadow-md'
                    }`}
                  >
                    {thumb ? (
                      <img src={thumb} alt={post.caption || ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-warm-cream" />
                    )}
                    {selected && (
                      <>
                        <div className="absolute inset-0 bg-campus-blue/20" />
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-campus-blue shadow-sm flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateFolder;
