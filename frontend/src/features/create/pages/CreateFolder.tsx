import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '@/shared/api/api';
import type { FolderType, Post } from '@/shared/types/Types';

const FOLDER_TYPES: {
  value: FolderType;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'collection',
    label: 'Collection',
    hint: 'Stickers you own',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    ),
  },
  {
    value: 'looking_for',
    label: 'Looking For',
    hint: 'Wishlist',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
      </svg>
    ),
  },
  {
    value: 'trading',
    label: 'Trading Away',
    hint: 'Open to swap',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
];

const MAX_UPLOAD_FILES = 20;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

import { API_BASE } from '@/shared/api/api';

const CreateFolder: React.FC = () => {
  const navigate = useNavigate();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [folderType, setFolderType] = useState<FolderType>('collection');
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      uploadPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
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
          image_paths:
            post.images
              ?.filter((img: any) => img?.paths?.medium)
              .map((img: any) => img.paths.original) ?? [],
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
    const incoming = Array.from(e.target.files);
    const valid = incoming.filter((f) => f.type.startsWith('image/'));
    const room = MAX_UPLOAD_FILES - uploadFiles.length;
    const accepted = valid.slice(0, Math.max(room, 0));

    if (accepted.length < incoming.length) {
      setUploadWarning(
        valid.length < incoming.length
          ? 'Some files were skipped — only image files are allowed.'
          : `Only the first ${MAX_UPLOAD_FILES} files can be uploaded at once.`,
      );
    } else {
      setUploadWarning(null);
    }

    const newPreviews = accepted.map((f) => URL.createObjectURL(f));
    setUploadFiles((prev) => [...prev, ...accepted]);
    setUploadPreviews((prev) => [...prev, ...newPreviews]);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const removeUploadAt = (idx: number) => {
    URL.revokeObjectURL(uploadPreviews[idx]);
    setUploadFiles((prev) => prev.filter((_, i) => i !== idx));
    setUploadPreviews((prev) => prev.filter((_, i) => i !== idx));
    setUploadWarning(null);
  };

  const togglePost = (postId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a folder name.');
      nameInputRef.current?.focus();
      return;
    }

    setSaving(true);
    setSavingProgress(null);
    setError(null);

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
        const formData = new FormData();
        formData.append('file', avatarFile);
        await fetchWithAuth(`${API_BASE}/folders/${folder!.id}/avatar`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      }

      for (let i = 0; i < uploadFiles.length; i++) {
        setSavingProgress(`Uploading sticker ${i + 1} of ${uploadFiles.length}…`);
        const fd = new FormData();
        fd.append('files', uploadFiles[i]);
        fd.append('is_published', 'true');
        const uploadRes = await fetchWithAuth(`${API_BASE}/folders/${folder!.id}/upload`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        if (!uploadRes.ok) {
          if (uploadRes.status === 429) {
            throw new Error('Upload limit reached. Please wait a bit and try again.');
          }
          throw new Error(`Sticker ${i + 1} of ${uploadFiles.length} failed to upload.`);
        }
        const body = await uploadRes.json();
        const id = body?.post_ids?.[0];
        if (typeof id === 'number') uploadedPostIds.push(id);
      }

      setSavingProgress(null);
      for (const postId of selectedIds) {
        await fetchWithAuth(`${API_BASE}/folders/${folder!.id}/posts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ post_id: postId }),
        });
      }

      const username = localStorage.getItem('username');
      navigate(username ? `/${username}` : '/');
    } catch (err) {
      console.error(err);

      setSavingProgress(uploadedPostIds.length ? 'Rolling back…' : null);
      for (const postId of uploadedPostIds) {
        try {
          await fetchWithAuth(`${API_BASE}/posts/${postId}`, { method: 'DELETE', credentials: 'include' });
        } catch (cleanupErr) {
          console.error('Rollback failed for post', postId, cleanupErr);
        }
      }
      if (folder) {
        try {
          await fetchWithAuth(`${API_BASE}/folders/${folder.id}`, { method: 'DELETE', credentials: 'include' });
        } catch (cleanupErr) {
          console.error('Rollback failed for folder', folder.id, cleanupErr);
        }
      }

      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
      setSavingProgress(null);
    }
  };

  const totalToAdd = uploadFiles.length + selectedIds.size;

  return (
    <div className="flex flex-col h-full bg-warm-cream overflow-hidden">

      {/* Header */}
      <div className="bg-white border-b border-warm-gray/20 px-6 py-4 flex items-center gap-4 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-espresso/45 hover:text-espresso transition-colors shrink-0"
          aria-label="Go back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-espresso">New Folder</h1>
          <p className="text-xs text-espresso/40 mt-0.5">Group your stickers by collection, wishlist, or trade pile.</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {saving && savingProgress && (
            <span className="text-xs text-espresso/45 italic">{savingProgress}</span>
          )}
          {error && <p className="text-sm text-brick-red">{error}</p>}
          {totalToAdd > 0 && !saving && (
            <span className="text-xs text-espresso/45">{totalToAdd} sticker{totalToAdd === 1 ? '' : 's'} ready</span>
          )}
          <button
            onClick={() => navigate(-1)}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-espresso/50 hover:text-espresso transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold bg-campus-blue text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
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

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">

        {/* Left sidebar — folder setup */}
        <div className="w-72 shrink-0 border-r border-warm-gray/20 bg-white overflow-y-auto px-6 py-8 space-y-8">

          {/* Cover photo */}
          <div>
            <p className="text-xs font-semibold text-espresso/50 mb-3">Cover photo</p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className={`relative w-full aspect-square overflow-hidden rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                avatarPreview
                  ? 'border-campus-blue/25'
                  : 'border-warm-gray/60 hover:border-campus-blue/40 hover:bg-warm-cream/50'
              }`}
              aria-label="Choose folder cover"
            >
              {avatarPreview ? (
                <>
                  <img src={avatarPreview} alt="Folder cover" className="absolute inset-0 w-full h-full object-cover" />
                  <span className="absolute inset-0 bg-black/35 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l-3 3v3h3l9-9-3-3-9 9z" />
                    </svg>
                  </span>
                </>
              ) : (
                <span className="flex flex-col items-center gap-2 text-espresso/30 pointer-events-none">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs font-medium text-espresso/40">Add cover</span>
                </span>
              )}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarSelect} />
          </div>

          {/* Folder name */}
          <div>
            <p className="text-xs font-semibold text-espresso/50 mb-2">Folder name</p>
            <input
              ref={nameInputRef}
              type="text"
              placeholder="e.g. Anteater Pep Rally 2024"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              className="w-full border border-warm-gray/60 rounded-lg px-3 py-2.5 text-sm text-espresso bg-white focus:border-campus-blue focus:ring-2 focus:ring-campus-blue/15 outline-none placeholder-espresso/25 transition-colors"
              maxLength={80}
            />
            <p className="text-xs text-espresso/30 mt-1.5">{name.length}/80</p>
          </div>

          {/* Folder type */}
          <div>
            <p className="text-xs font-semibold text-espresso/50 mb-3">Type</p>
            <div className="space-y-2">
              {FOLDER_TYPES.map((ft) => {
                const active = folderType === ft.value;
                return (
                  <button
                    key={ft.value}
                    type="button"
                    onClick={() => setFolderType(ft.value)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-all ${
                      active
                        ? 'border-campus-blue/60 bg-campus-blue/6 text-espresso shadow-sm'
                        : 'border-warm-gray/50 text-espresso/55 hover:border-warm-gray hover:bg-warm-cream/50'
                    }`}
                  >
                    <span className={`flex items-center justify-center w-8 h-8 rounded-md shrink-0 transition-colors ${
                      active ? 'bg-campus-blue text-white' : 'bg-warm-cream text-espresso/40'
                    }`}>
                      {ft.icon}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm font-semibold">{ft.label}</span>
                      <span className="text-xs text-espresso/40 mt-0.5">{ft.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel — sticker content */}
        <div className="flex-1 overflow-y-auto">

          {/* Upload section */}
          <div className="px-8 py-7 border-b border-warm-gray/20 bg-white">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-sm font-semibold text-espresso">Upload stickers</p>
              <span className="text-xs text-espresso/35">{uploadFiles.length} / {MAX_UPLOAD_FILES}</span>
            </div>
            <p className="text-xs text-espresso/45 mb-5">Each image becomes its own post inside this folder.</p>

            <div className="flex flex-wrap gap-3">
              {uploadPreviews.map((src, i) => (
                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden shadow-sm group/upload">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeUploadAt(i)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-espresso/75 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover/upload:opacity-100 transition-opacity hover:bg-brick-red"
                    aria-label="Remove file"
                  >×</button>
                </div>
              ))}

              {uploadFiles.length < MAX_UPLOAD_FILES && (
                <label className="w-24 h-24 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-warm-gray/50 rounded-lg cursor-pointer text-espresso/30 hover:border-campus-blue/50 hover:bg-warm-cream/50 hover:text-campus-blue transition-all">
                  <input ref={uploadInputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={handleUploadFilesChange} />
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-xs font-medium">Add</span>
                </label>
              )}
            </div>

            {uploadWarning && (
              <p className="text-xs text-brick-red/80 bg-brick-red/8 border border-brick-red/15 rounded-lg px-3 py-2 mt-4">
                {uploadWarning}
              </p>
            )}
          </div>

          {/* Existing posts */}
          <div className="px-8 py-7">
            <div className="flex items-baseline justify-between mb-5">
              <p className="text-sm font-semibold text-espresso">Add from your collection</p>
              {selectedIds.size > 0 && (
                <span className="text-xs font-semibold text-campus-blue bg-campus-blue/10 px-2.5 py-1 rounded-full">
                  {selectedIds.size} selected
                </span>
              )}
            </div>

            {loadingPosts ? (
              <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-warm-gray/20 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-warm-gray/40 rounded-xl">
                <svg className="w-10 h-10 text-espresso/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-espresso/40">No posts yet — upload some above to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {posts.map((post) => {
                  const selected = selectedIds.has(post.post_id);
                  const thumb = post.image_paths[0];
                  return (
                    <button
                      key={post.post_id}
                      onClick={() => togglePost(post.post_id)}
                      className={`relative aspect-square overflow-hidden rounded-lg transition-all ${
                        selected
                          ? 'ring-2 ring-campus-blue ring-offset-2 ring-offset-warm-cream'
                          : 'ring-1 ring-warm-gray/30 hover:ring-2 hover:ring-campus-blue/40'
                      }`}
                    >
                      {thumb ? (
                        <img src={thumb} alt={post.caption || `Post ${post.post_id}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-warm-cream flex items-center justify-center">
                          <svg className="w-5 h-5 text-espresso/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                          </svg>
                        </div>
                      )}
                      {selected && (
                        <>
                          <div className="absolute inset-0 bg-campus-blue/15" />
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-campus-blue flex items-center justify-center shadow-sm">
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
    </div>
  );
};

export default CreateFolder;
