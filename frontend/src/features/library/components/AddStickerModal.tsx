import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithAuth, API_BASE } from '@/shared/api/api';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const AddStickerModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [petrDropper, setPetrDropper] = useState('');
  const [dropDate, setDropDate] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
      
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const mutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetchWithAuth(`${API_BASE}/library/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to upload');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || selectedFiles.length === 0) return;

    const formData = new FormData();
    formData.append('title', title);
    formData.append('petr_dropper', petrDropper);
    formData.append('drop_date', dropDate);
    formData.append('description', description);
    selectedFiles.forEach(file => {
      formData.append('images', file);
    });

    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh] bg-white">
        <div className="p-5 border-b border-warm-gray/40 flex items-center justify-between">
          <h2 className="text-lg font-bold text-espresso">Add New Sticker</h2>
          <button onClick={onClose} className="text-espresso/40 hover:text-espresso transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-espresso/50 uppercase tracking-widest mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-warm-gray rounded-lg focus:border-campus-blue focus:ring-1 focus:ring-campus-blue/20 outline-none transition-all bg-white text-espresso placeholder-warm-gray"
              placeholder="e.g. Holo Petr"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-espresso/50 uppercase tracking-widest mb-1">Petr Dropper</label>
              <input
                type="text"
                value={petrDropper}
                onChange={(e) => setPetrDropper(e.target.value)}
                className="w-full px-3 py-2.5 border border-warm-gray rounded-lg focus:border-campus-blue focus:ring-1 focus:ring-campus-blue/20 outline-none transition-all bg-white text-espresso placeholder-warm-gray"
                placeholder="Name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-espresso/50 uppercase tracking-widest mb-1">Drop Date</label>
              <input
                type="text"
                value={dropDate}
                onChange={(e) => setDropDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-warm-gray rounded-lg focus:border-campus-blue focus:ring-1 focus:ring-campus-blue/20 outline-none transition-all bg-white text-espresso placeholder-warm-gray"
                placeholder="e.g. Fall 2025"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-espresso/50 uppercase tracking-widest mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 border border-warm-gray rounded-lg focus:ring-2 focus:ring-uci-gold outline-none transition-all h-24 resize-none bg-white/70 text-espresso placeholder-warm-gray"
              placeholder="Lore or details..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-espresso/50 uppercase tracking-widest mb-1">Images *</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-warm-gray">
                  <img src={src} className="w-full h-full object-cover" />
                </div>
              ))}
              <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed border-warm-gray rounded-lg cursor-pointer hover:border-uci-gold hover:bg-uci-gold/10 transition-all">
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                <svg className="w-6 h-6 text-warm-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </label>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={mutation.isPending || !title || selectedFiles.length === 0}
              className="w-full py-3 bg-campus-blue text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {mutation.isPending ? 'Uploading...' : 'Add to Library'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStickerModal;
