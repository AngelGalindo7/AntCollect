import React, { useEffect, useRef, useState } from 'react';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';
import type { FolderType } from '@/shared/types/Types';

const MAX_FILES = 20;
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

type ItemStatus = 'queued' | 'uploading' | 'done' | 'error';

interface FileItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ItemStatus;
  postId?: number;
  error?: string;
  abort?: AbortController;
}

const AddStickersModal: React.FC<Props> = ({ folderId, folderType, onClose, onUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<FileItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  const itemsRef = useRef<FileItem[]>(items);
  itemsRef.current = items;
  const workingRef = useRef(false);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => {
        URL.revokeObjectURL(it.previewUrl);
        it.abort?.abort();
      });
    };
  }, []);

  const updateItem = (id: string, patch: Partial<FileItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItemFromState = (id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  };

  const uploadOne = async (item: FileItem) => {
    const controller = new AbortController();
    updateItem(item.id, { status: 'uploading', abort: controller });

    const fd = new FormData();
    fd.append('files', item.file);
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
        updateItem(item.id, { status: 'error', error: detail, abort: undefined });
        return;
      }

      const body = await res.json();
      const postId = body.post_ids?.[0];
      updateItem(item.id, { status: 'done', postId, abort: undefined });
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error(err);
      updateItem(item.id, {
        status: 'error',
        error: 'Network error',
        abort: undefined,
      });
    }
  };

  useEffect(() => {
    const drain = async () => {
      if (workingRef.current) return;
      workingRef.current = true;
      try {
        while (true) {
          const next = itemsRef.current.find((it) => it.status === 'queued');
          if (!next) break;
          await uploadOne(next);
        }
      } finally {
        workingRef.current = false;
      }
    };
    if (items.some((it) => it.status === 'queued')) {
      drain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((f) => f.type.startsWith('image/'));
    const room = MAX_FILES - items.length;
    const accepted = valid.slice(0, Math.max(room, 0));
    const truncated = incoming.length - accepted.length;

    if (truncated > 0) {
      setWarning(
        valid.length < incoming.length
          ? 'Some files were skipped — only image files are allowed.'
          : `Only the first ${MAX_FILES} files can be added.`,
      );
    } else {
      setWarning(null);
    }

    const newItems: FileItem[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'queued',
    }));
    setItems((prev) => [...prev, ...newItems]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeItem = async (id: string) => {
    const target = itemsRef.current.find((it) => it.id === id);
    if (!target) return;

    if (target.status === 'uploading') target.abort?.abort();

    if (target.status === 'done' && target.postId !== undefined) {
      removeItemFromState(id);
      try {
        await fetchWithAuth(
          `${API_BASE}/folders/${folderId}/posts/${target.postId}`,
          { method: 'DELETE', credentials: 'include' },
        );
      } catch (err) {
        console.error('Failed to detach uploaded sticker', err);
      }
    } else {
      removeItemFromState(id);
    }
    setWarning(null);
  };

  const retryItem = (id: string) => {
    updateItem(id, { status: 'queued', error: undefined });
  };

  const counts = items.reduce(
    (acc, it) => {
      acc[it.status] += 1;
      return acc;
    },
    { queued: 0, uploading: 0, done: 0, error: 0 } as Record<ItemStatus, number>,
  );
  const inFlight = counts.queued + counts.uploading;
  const canClose = inFlight === 0;

  const handleClose = () => {
    if (!canClose) return;
    const doneIds = items
      .filter((it) => it.status === 'done' && it.postId !== undefined)
      .map((it) => it.postId!) as number[];
    if (doneIds.length > 0) onUploaded(doneIds);
    onClose();
  };

  const ctaLabel =
    inFlight > 0
      ? `Uploading ${counts.uploading + counts.queued}…`
      : counts.done > 0
        ? `Done — added ${counts.done} sticker${counts.done === 1 ? '' : 's'}`
        : 'Close';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ fontFamily: "'Quicksand', sans-serif" }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={canClose ? handleClose : undefined} />

      <div
        className="relative w-full max-w-xl rounded-[24px] overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: '#FDFCF0' }}
      >
        <div className="p-5 border-b border-warm-gray/40 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-espresso">Add Stickers</h2>
            <p className="text-xs text-espresso/50 mt-0.5">
              Each image becomes a {FOLDER_TYPE_LABELS[folderType]} post in this folder.
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

                {(it.status === 'queued' || it.status === 'uploading') && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                )}

                {it.status === 'done' && (
                  <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                {it.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => retryItem(it.id)}
                    title={it.error ?? 'Upload failed — click to retry'}
                    className="absolute inset-0 bg-brick-red/70 flex items-center justify-center text-[10px] text-white font-bold"
                  >
                    Retry
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                  aria-label="Remove file"
                >
                  ×
                </button>
              </div>
            ))}

            {items.length < MAX_FILES && (
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
              {items.length} of {MAX_FILES} selected
              {counts.done > 0 && ` · ${counts.done} uploaded`}
              {counts.error > 0 && ` · ${counts.error} failed`}
            </span>
          </div>

          {warning && <p className="text-xs text-amber-700">{warning}</p>}

          <div className="pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={!canClose}
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
