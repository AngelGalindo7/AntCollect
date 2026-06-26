import React, { useState } from 'react';
import { apiFetch, fetchWithAuth, API_BASE } from '@/shared/api/api';
import { handleApiError } from '@/shared/feedback/useApiErrorHandler';
import type { FieldErrorMap } from '@/shared/feedback/useApiErrorHandler';
import { toast } from '@/shared/feedback/toastStore';

const POST_TYPES = [
  {
    value: 'collection',
    label: 'Collectible',
    desc: 'Something I own',
    active: 'bg-campus-blue text-white ring-2 ring-campus-blue/30',
    idle: 'bg-white border border-warm-gray/60 text-espresso/70 hover:border-campus-blue/50 hover:bg-blue-50/50',
  },
  {
    value: 'trading',
    label: 'Trading',
    desc: 'Available to trade',
    active: 'bg-campus-blue text-white ring-2 ring-campus-blue/30',
    idle: 'bg-white border border-warm-gray/60 text-espresso/70 hover:border-campus-blue/50 hover:bg-blue-50/50',
  },
  {
    value: 'looking_for',
    label: 'Looking For',
    desc: 'I want this one',
    active: 'bg-campus-blue text-white ring-2 ring-campus-blue/30',
    idle: 'bg-white border border-warm-gray/60 text-espresso/70 hover:border-campus-blue/50 hover:bg-blue-50/50',
  },
] as const;

type PostTypeValue = typeof POST_TYPES[number]['value'];

interface CreatePostProps {
  onSuccess?: () => void;
}

function CreatePost({ onSuccess }: CreatePostProps) {
  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [postType, setPostType] = useState<PostTypeValue>('collection');
  const [addToCollection, setAddToCollection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const picked = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...picked]);
    setPreviews((prev) => [...prev, ...picked.map((f) => URL.createObjectURL(f))]);
  };

  const removeFile = (i: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[i]);
      return prev.filter((_, idx) => idx !== i);
    });
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    const formData = new FormData();
    formData.append('caption', caption);
    formData.append('is_published', 'true');
    formData.append('post_type', postType);
    files.forEach((file) => formData.append('post_images', file));

    try {
      const res = await apiFetch(`${API_BASE}/posts/upload-post`, {
        method: 'POST',
        body: formData,
      });
      const { post_id } = (await res.json()) as { post_id: string; message: string };

      if (addToCollection && postType !== 'looking_for' && post_id) {
        const groups = files.map((_, i) => [i + 1]);
        try {
          await fetchWithAuth(`${API_BASE}/stickers/me/from-post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: Number(post_id), groups }),
          });
          toast.success(`Post shared · ${files.length} sticker${files.length !== 1 ? 's' : ''} added to your collection`);
        } catch {
          toast.success('Post shared · could not add stickers to collection');
        }
      } else {
        toast.success('Post shared');
      }

      setCaption('');
      setFiles([]);
      setPreviews([]);
      setPostType('collection');
      setAddToCollection(false);
      onSuccess?.();
    } catch (err) {
      handleApiError(err, { setFieldErrors });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 w-full max-w-lg p-7 rounded-2xl shadow-2xl bg-white"
    >
      <div>
        <h2 className="text-xl font-bold text-espresso">New Post</h2>
        <p className="text-sm text-espresso/50 mt-0.5">Share a sticker with the community</p>
      </div>

      {/* Post type selector */}
      <div>
        <p className="text-xs font-bold text-espresso/50 uppercase tracking-widest mb-2">What kind of post?</p>
        <div className="grid grid-cols-3 gap-2">
          {POST_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setPostType(t.value)}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-2xl font-bold text-sm transition-all ${
                postType === t.value ? t.active : t.idle
              }`}
            >
              <span className="leading-tight">{t.label}</span>
              <span className={`text-[10px] font-medium leading-tight ${postType === t.value ? 'opacity-80' : 'opacity-50'}`}>
                {t.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Image upload */}
      <div>
        <p className="text-xs font-bold text-espresso/50 uppercase tracking-widest mb-2">Images</p>
        {previews.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-2">
            {previews.map((src, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-espresso/70 text-white text-xs flex items-center justify-center leading-none hover:bg-brick-red transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
            <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed border-warm-gray rounded-xl cursor-pointer hover:border-uci-gold hover:bg-uci-gold/10 transition-all text-espresso/40">
              <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </label>
          </div>
        ) : (
          <label
            htmlFor="cp-file-upload"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-warm-gray rounded-2xl cursor-pointer hover:border-uci-gold hover:bg-uci-gold/10 transition-all gap-2"
          >
            <svg className="w-6 h-6 text-espresso/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-semibold text-espresso/50">Click to add sticker images</span>
            <input
              id="cp-file-upload"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
        {fieldErrors.post_images && (
          <p role="alert" className="text-xs text-brick-red mt-1.5 font-medium">
            {fieldErrors.post_images}
          </p>
        )}
      </div>

      {/* Caption */}
      <div>
        <p className="text-xs font-bold text-espresso/50 uppercase tracking-widest mb-2">Caption</p>
        <textarea
          placeholder="What's this sticker all about?"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 border border-warm-gray rounded-lg focus:border-campus-blue focus:ring-1 focus:ring-campus-blue/20 outline-none resize-none bg-white text-espresso placeholder-warm-gray text-sm"
        />
      </div>

      {postType !== 'looking_for' && (
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={addToCollection}
            onChange={(e) => setAddToCollection(e.target.checked)}
            className="rounded accent-uci-gold w-4 h-4"
          />
          <span className="text-sm text-espresso/70">Add to my sticker collection</span>
        </label>
      )}

      <button
        type="submit"
        disabled={isSubmitting || files.length === 0}
        className="w-full py-3 bg-campus-blue text-white font-bold rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Posting…' : 'Share Post'}
      </button>
    </form>
  );
}

export default CreatePost;
