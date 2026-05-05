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

type Status = 'idle' | 'uploading' | 'error';

const AddStickersModal: React.FC<Props> = ({ folderId, folderType, onClose, onUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter((f) => f.type.startsWith('image/'));
    const room = MAX_FILES - files.length;
    const accepted = valid.slice(0, Math.max(room, 0));
    const truncated = incoming.length - accepted.length;

    if (truncated > 0) {
      setWarning(
        valid.length < incoming.length
          ? 'Some files were skipped — only image files are allowed.'
          : `Only the first ${MAX_FILES} files can be uploaded at once.`,
      );
    } else {
      setWarning(null);
    }

    const newPreviews = accepted.map((f) => URL.createObjectURL(f));
    setFiles((prev) => [...prev, ...accepted]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addFiles(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAt = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
    setWarning(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setStatus('uploading');
    setErrorMsg(null);

    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    fd.append('is_published', 'true');

    try {
      const res = await fetchWithAuth(`${API_BASE}/folders/${folderId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) {
        let detail = `Upload failed (${res.status})`;
        if (res.status === 429) {
          detail = "You've hit the upload limit for this hour. Please try again later.";
        } else {
          try {
            const body = await res.json();
            if (body?.detail) detail = body.detail;
          } catch {}
        }
        setErrorMsg(detail);
        setStatus('error');
        return;
      }
      const body = await res.json();
      onUploaded(body.post_ids ?? []);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  const isUploading = status === 'uploading';
  const ctaLabel = isUploading
    ? 'Uploading…'
    : status === 'error'
      ? `Retry (${files.length})`
      : `Upload ${files.length} ${files.length === 1 ? 'sticker' : 'stickers'}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ fontFamily: "'Quicksand', sans-serif" }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={isUploading ? undefined : onClose} />

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
            onClick={onClose}
            disabled={isUploading}
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
            {previews.map((src, i) => (
              <div
                key={i}
                className="relative w-20 h-20 rounded-lg overflow-hidden border border-warm-gray group/thumb"
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    aria-label="Remove file"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {files.length < MAX_FILES && (
              <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed border-warm-gray rounded-lg cursor-pointer hover:border-uci-gold hover:bg-uci-gold/10 transition-all">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                <svg className="w-6 h-6 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </label>
            )}
          </div>

          <p className="text-xs text-espresso/40">
            {files.length} of {MAX_FILES} selected
          </p>

          {warning && <p className="text-xs text-amber-700">{warning}</p>}
          {errorMsg && <p className="text-sm text-brick-red">{errorMsg}</p>}

          <div className="pt-2">
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
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
