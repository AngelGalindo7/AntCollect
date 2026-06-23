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
      // Step 1: create the folder
      const createRes = await fetchWithAuth(`${API_BASE}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmed, description: null, is_public: true, folder_type: folderType }),
      });
      if (!createRes.ok) throw new Error('Failed to create folder.');
      folder = await createRes.json();

      // Step 2: upload avatar if one was selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        await fetchWithAuth(`${API_BASE}/folders/${folder!.id}/avatar`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      }

      // Step 3: upload sticker images one at a time, tracking each created post_id
      // so we can roll back if any subsequent step fails.
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

      // Step 4: attach selected existing posts (does NOT create posts, just links)
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

      // Roll back: delete every post we created in this save attempt, then the folder.
      // DELETE /posts/{id} cascades PostImage/FolderPost rows and cleans up S3 files.
      // DELETE /folders/{id} removes the empty folder. Best-effort — failures are logged
      // but never block surfacing the original error to the user.
      setSavingProgress(uploadedPostIds.length ? 'Rolling back…' : null);
      for (const postId of uploadedPostIds) {
        try {
          await fetchWithAuth(`${API_BASE}/posts/${postId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        } catch (cleanupErr) {
          console.error('Rollback failed for post', postId, cleanupErr);
        }
      }
      if (folder) {
        try {
          await fetchWithAuth(`${API_BASE}/folders/${folder.id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
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
    <div className="min-h-screen pb-32">
      <div className="max-w-3xl mx-auto pt-10 px-4">
        {/* Back link */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-espresso/50 hover:text-espresso transition-colors mb-5"
          aria-label="Go back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Page card */}
        <div className="bg-white rounded-3xl shadow-soft border border-warm-gray/40 overflow-hidden">
          {/* Hero strip */}
          <div className="relative bg-gradient-to-br from-uci-gold/30 via-warm-cream to-soft-white px-8 pt-8 pb-10">
            <h1 className="text-3xl font-display font-bold text-espresso tracking-tight">
              New Folder
            </h1>
            <p className="text-sm text-espresso/55 mt-1">
              Group your stickers by collection, wishlist, or trade pile.
            </p>

            {/* Identity row */}
            <div className="flex items-center gap-5 mt-7">
              {/* Avatar */}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className={`relative w-24 h-24 rounded-full shrink-0 group transition-all ${
                  avatarPreview
                    ? 'ring-4 ring-uci-gold/50 ring-offset-2 ring-offset-warm-cream'
                    : 'bg-soft-white border-2 border-dashed border-warm-gray hover:border-uci-gold hover:bg-uci-gold/5'
                }`}
                aria-label="Choose folder avatar"
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Folder avatar"
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="absolute inset-0 flex flex-col items-center justify-center text-espresso/40 group-hover:text-espresso/70 transition-colors">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-[10px] font-semibold uppercase tracking-wider mt-1">Cover</span>
                  </span>
                )}
                {avatarPreview && (
                  <span className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l-3 3v3h3l9-9-3-3-9 9z" />
                    </svg>
                  </span>
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarSelect}
              />

              {/* Name input */}
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-bold text-espresso/55 uppercase tracking-widest">
                  Folder name
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="e.g. Anteater Pep Rally 2024"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(null); }}
                  className="w-full mt-1 text-xl font-display font-semibold bg-white/80 border border-warm-gray rounded-xl px-4 py-2.5 focus:border-campus-blue focus:ring-1 focus:ring-campus-blue/20 outline-none placeholder-espresso/30 transition-colors text-espresso"
                  maxLength={80}
                />
                {error ? (
                  <p className="text-sm text-brick-red mt-1.5">{error}</p>
                ) : (
                  <p className="text-[11px] text-espresso/40 mt-1.5">
                    {name.length}/80
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Body sections */}
          <div className="px-8 py-8 space-y-9">
            {/* Folder type */}
            <section>
              <p className="text-[11px] font-bold text-espresso/55 uppercase tracking-widest mb-3">
                Folder type
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {FOLDER_TYPES.map((ft) => {
                  const active = folderType === ft.value;
                  return (
                    <button
                      key={ft.value}
                      type="button"
                      onClick={() => setFolderType(ft.value)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                        active
                          ? 'bg-campus-blue/10 border-campus-blue text-espresso shadow-[0_2px_10px_rgba(0,100,164,0.15)]'
                          : 'bg-white border-warm-gray/60 text-espresso/70 hover:border-campus-blue/50 hover:bg-blue-50/40'
                      }`}
                    >
                      <span className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${
                        active ? 'bg-campus-blue text-white' : 'bg-warm-cream text-espresso/55'
                      }`}>
                        {ft.icon}
                      </span>
                      <span className="flex flex-col leading-tight">
                        <span className="text-sm font-semibold">{ft.label}</span>
                        <span className="text-[11px] text-espresso/45">{ft.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Upload */}
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-[11px] font-bold text-espresso/55 uppercase tracking-widest">
                  Upload new stickers
                </p>
                <span className="text-[11px] text-espresso/45 font-medium">
                  {uploadFiles.length} / {MAX_UPLOAD_FILES}
                </span>
              </div>
              <p className="text-xs text-espresso/50 mb-3">
                Each image becomes its own post inside this folder.
              </p>

              <div className="flex flex-wrap gap-2.5">
                {uploadPreviews.map((src, i) => (
                  <div
                    key={i}
                    className="relative w-24 h-24 rounded-xl overflow-hidden border border-warm-gray/60 shadow-sm group/upload"
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeUploadAt(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-espresso/85 text-white text-sm leading-none flex items-center justify-center opacity-0 group-hover/upload:opacity-100 transition-opacity hover:bg-brick-red"
                      aria-label="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {uploadFiles.length < MAX_UPLOAD_FILES && (
                  <label className="w-24 h-24 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-warm-gray rounded-xl cursor-pointer text-espresso/45 hover:border-uci-gold hover:bg-uci-gold/10 hover:text-espresso transition-all">
                    <input
                      ref={uploadInputRef}
                      type="file"
                      multiple
                      accept={ACCEPT}
                      className="hidden"
                      onChange={handleUploadFilesChange}
                    />
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Add</span>
                  </label>
                )}
              </div>
              {uploadWarning && (
                <p className="text-xs text-brick-red/90 bg-brick-red/10 border border-brick-red/20 rounded-lg px-3 py-2 mt-3">
                  {uploadWarning}
                </p>
              )}
            </section>

            {/* Existing posts */}
            <section>
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-[11px] font-bold text-espresso/55 uppercase tracking-widest">
                  Pick from existing posts
                </p>
                {selectedIds.size > 0 && (
                  <span className="text-[11px] font-semibold text-espresso bg-uci-gold/30 px-2 py-0.5 rounded-full">
                    {selectedIds.size} selected
                  </span>
                )}
              </div>

              {loadingPosts ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-xl bg-warm-cream/70 animate-pulse"
                    />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-12 px-6 bg-warm-cream/50 rounded-2xl border border-dashed border-warm-gray/70">
                  <svg className="w-10 h-10 text-espresso/25 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-espresso/55">No posts yet — upload some above to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {posts.map((post) => {
                    const selected = selectedIds.has(post.post_id);
                    const thumb = post.image_paths[0];
                    return (
                      <button
                        key={post.post_id}
                        onClick={() => togglePost(post.post_id)}
                        className={`relative aspect-square rounded-xl overflow-hidden transition-all ${
                          selected
                            ? 'ring-2 ring-uci-gold ring-offset-2 ring-offset-soft-white'
                            : 'ring-1 ring-warm-gray/50 hover:ring-2 hover:ring-uci-gold/50'
                        }`}
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={post.caption || `Post ${post.post_id}`}
                            className={`w-full h-full object-cover transition-transform ${
                              selected ? 'scale-95' : 'group-hover:scale-105'
                            }`}
                          />
                        ) : (
                          <div className="w-full h-full bg-warm-cream flex items-center justify-center">
                            <svg className="w-8 h-8 text-espresso/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                            </svg>
                          </div>
                        )}

                        {selected && (
                          <div className="absolute inset-0 bg-uci-gold/15" />
                        )}

                        {selected && (
                          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-uci-gold shadow-md flex items-center justify-center">
                            <svg className="w-4 h-4 text-espresso" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-soft-white/95 backdrop-blur-md border-t border-warm-gray/50 shadow-[0_-4px_20px_rgba(101,67,33,0.06)]">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="text-xs text-espresso/55 min-w-0 truncate">
            {saving ? (
              <span className="inline-flex items-center gap-2 text-espresso">
                <svg className="w-4 h-4 animate-spin text-uci-gold" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                </svg>
                {savingProgress ?? 'Saving folder…'}
              </span>
            ) : totalToAdd > 0 ? (
              <span>
                <strong className="text-espresso font-semibold">{totalToAdd}</strong>
                {' '}sticker{totalToAdd === 1 ? '' : 's'} ready to add
              </span>
            ) : (
              <span>No stickers selected — folder will be empty.</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-espresso/60 hover:text-espresso transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-bold bg-campus-blue text-white rounded-xl hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? 'Saving…' : 'Create Folder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateFolder;
