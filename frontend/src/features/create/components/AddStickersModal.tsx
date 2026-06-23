import React, { useEffect, useRef, useState } from 'react';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';
import type { FolderType } from '@/shared/types/Types';

const MAX_IMAGES_PER_POST = 5;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const FOLDER_TYPE_LABELS: Record<FolderType, string> = {
  collection: 'Collection',
  looking_for: 'Looking For',
  trading: 'Trading Away',
};

interface Props {
  folderId: number;
  folderType: FolderType;
  onClose: () => void;
  onUploaded: (postIds: number[]) => void;
}

type BatchStatus = 'idle' | 'uploading' | 'done' | 'error';

interface FileItem {
  id: string;
  file: File;
  previewUrl: string;
}

const AddStickersModal: React.FC<Props> = ({ folderId, folderType, onClose, onUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [status, setStatus] = useState<BatchStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploadedPostId, setUploadedPostId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const itemsRef = useRef<FileItem[]>(items);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      abortRef.current?.abort();
    };
  }, []);

  const removeItemFromState = (id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  };

  const addFiles = (incoming: File[]) => {
    if (status === 'uploading' || status === 'done') return;

    const valid = incoming.filter((f) => f.type.startsWith('image/'));
    const room = MAX_IMAGES_PER_POST - items.length;
    const accepted = valid.slice(0, Math.max(room, 0));
    const truncated = incoming.length - accepted.length;

    if (truncated > 0) {
      setWarning(
        valid.length < incoming.length
          ? 'Some files were skipped — only image files are allowed.'
          : `A post can hold at most ${MAX_IMAGES_PER_POST} images.`,
      );
    } else {
      setWarning(null);
    }

    const newItems: FileItem[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setItems((prev) => [...prev, ...newItems]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeItem = (id: string) => {
    if (status === 'uploading' || status === 'done') return;
    removeItemFromState(id);
    setWarning(null);
  };

  const submitUpload = async () => {
    if (items.length === 0 || status === 'uploading') return;

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('uploading');
    setError(null);

    const fd = new FormData();
    items.forEach((it) => fd.append('files', it.file));
    fd.append('is_published', 'true');

    try {
      const res = await fetchWithAuth(`${API_BASE}/folders/${folderId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
        signal: controller.signal,
      });

      if (!res.ok) {
        let detail = `Upload failed (${res.status})`;
        if (res.status === 429) {
          detail = 'Upload limit reached for this hour.';
        } else {
          try {
            const body = await res.json();
            if (body?.detail) detail = body.detail;
          } catch {}
        }
        setStatus('error');
        setError(detail);
        return;
      }

      const body = await res.json();
      const postId: number | undefined = body.post_id;
      if (typeof postId !== 'number') {
        setStatus('error');
        setError('Upload succeeded but server response was malformed.');
        return;
      }
      setUploadedPostId(postId);
      setStatus('done');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setStatus('idle');
        return;
      }
      console.error(err);
      setStatus('error');
      setError('Network error');
    } finally {
      abortRef.current = null;
    }
  };

  const retry = () => {
    setError(null);
    setStatus('idle');
  };

  const handleClose = () => {
    if (status === 'uploading') return;
    if (uploadedPostId !== null) onUploaded([uploadedPostId]);
    onClose();
  };

  const canClose = status !== 'uploading';
  const canEditQueue = status === 'idle' || status === 'error';
  const canSubmit = canEditQueue && items.length > 0;

  let ctaLabel: string;
  let ctaAction: () => void;
  let ctaDisabled = false;
  if (status === 'uploading') {
    ctaLabel = 'Uploading…';
    ctaAction = () => {};
    ctaDisabled = true;
  } else if (status === 'done') {
    ctaLabel = `Done — added 1 post (${items.length} ${items.length === 1 ? 'image' : 'images'})`;
    ctaAction = handleClose;
  } else if (status === 'error') {
    ctaLabel = 'Retry upload';
    ctaAction = () => {
      retry();
      submitUpload();
    };
  } else {
    ctaLabel = items.length === 0 ? 'Add images first' : `Create post (${items.length} ${items.length === 1 ? 'image' : 'images'})`;
    ctaAction = submitUpload;
    ctaDisabled = !canSubmit;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ fontFamily: "'Quicksand', sans-serif" }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={canClose ? handleClose : undefined} />

      <div
        className="relative w-full max-w-xl rounded-[24px] overflow-hidden flex flex-col max-h-[90vh] bg-warm-cream"
      >
        <div className="p-5 border-b border-warm-gray/40 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-espresso">Add Stickers</h2>
            <p className="text-xs text-espresso/50 mt-0.5">
              These images will become <strong>one</strong> {FOLDER_TYPE_LABELS[folderType]} post in this folder. Up to {MAX_IMAGES_PER_POST} images per post.
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={!canClose}
            className="text-espresso/40 hover:text-espresso transition-colors disabled:opacity-30"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="relative w-20 h-20 rounded-lg overflow-hidden border border-warm-gray group/thumb"
              >
                <img src={it.previewUrl} alt="" className="w-full h-full object-cover" />

                {status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                )}

                {status === 'done' && (
                  <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                {canEditQueue && (
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {items.length < MAX_IMAGES_PER_POST && canEditQueue && (
              <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed border-warm-gray rounded-lg cursor-pointer hover:border-uci-gold hover:bg-uci-gold/10 transition-all">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={handleFileChange}
                />
                <svg className="w-6 h-6 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </label>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-espresso/40">
              {items.length} of {MAX_IMAGES_PER_POST} selected
            </span>
          </div>

          {warning && <p className="text-xs text-amber-700">{warning}</p>}
          {error && <p className="text-xs text-brick-red">{error}</p>}

          <div className="pt-2">
            <button
              type="button"
              onClick={ctaAction}
              disabled={ctaDisabled}
              className="w-full py-3 bg-uci-gold text-espresso rounded-xl font-bold hover:bg-amber-400 disabled:bg-warm-gray/50 disabled:text-espresso/40 disabled:cursor-not-allowed transition-colors"
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddStickersModal;
