import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { getMyWorkspace, createPanel } from '@/features/workspace/api/workspaceApi';
import { StudioPanelCard } from '../components/StudioPanelCard';
import { NewPanelModal } from '../components/NewPanelModal';
import type { Panel } from '@/features/workspace/types/workspace';

function TreasureChest() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="50" width="100" height="40" rx="6" fill="#D4A843" stroke="#B8892A" strokeWidth="2" />
      <rect x="10" y="30" width="100" height="24" rx="6" fill="#C49834" stroke="#B8892A" strokeWidth="2" />
      <rect x="10" y="46" width="100" height="8" fill="#B8892A" opacity="0.3" />
      <rect x="16" y="64" width="88" height="4" rx="2" fill="#B8892A" opacity="0.4" />
      <circle cx="60" cy="50" r="7" fill="#FFD700" stroke="#B8892A" strokeWidth="1.5" />
      <circle cx="60" cy="50" r="3" fill="#B8892A" opacity="0.5" />
      <rect x="50" y="12" width="20" height="20" rx="4" fill="#8B6914" stroke="#6B4E0E" strokeWidth="1.5" />
      <rect x="54" y="17" width="12" height="8" rx="2" fill="#6B4E0E" opacity="0.35" />
      <path d="M28 30L18 46" stroke="#B8892A" strokeWidth="1.5" strokeDasharray="3 2" />
      <path d="M92 30L102 46" stroke="#B8892A" strokeWidth="1.5" strokeDasharray="3 2" />
    </svg>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
      <TreasureChest />
      <div>
        <h2 className="text-xl font-bold text-espresso">Your Studio is empty</h2>
        <p className="text-sm text-espresso/50 mt-1">
          Create your first canvas to start building your showcase
        </p>
      </div>
      <button
        onClick={onNew}
        className="px-6 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
        style={{ background: '#0064A4' }}
      >
        Create Canvas
      </button>
    </div>
  );
}

export default function StudioPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNewModal, setShowNewModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['workspace'],
    queryFn: getMyWorkspace,
  });

  const panels: Panel[] = (data?.panels ?? [])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const handleCreate = async (w: number, h: number, title: string | null) => {
    const panel = await createPanel({ w, h, title: title ?? undefined });
    setShowNewModal(false);
    await queryClient.invalidateQueries({ queryKey: ['workspace'] });
    navigate(`/studio/canvas/${panel.id}`);
  };

  return (
    <div
      className="min-h-screen relative"
      style={{ background: '#FDFCF0', fontFamily: "'Quicksand', sans-serif" }}
    >
      {/* Dot grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10">
        {/* Page header */}
        <div className="bg-white border-b border-warm-gray/30 px-6 py-4 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-campus-blue shrink-0" />
          <h1 className="text-lg font-bold text-espresso flex-1">Your Studio</h1>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
            style={{ background: '#0064A4' }}
          >
            <Plus className="w-4 h-4" />
            New Canvas
          </button>
        </div>

        {/* Gallery */}
        <div className="max-w-5xl mx-auto px-6 py-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-espresso/40 text-sm">
              Loading…
            </div>
          ) : panels.length === 0 ? (
            <EmptyState onNew={() => setShowNewModal(true)} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {panels.map((panel, i) => (
                <StudioPanelCard
                  key={panel.id}
                  panel={panel}
                  index={i}
                  onDeleted={() =>
                    queryClient.invalidateQueries({ queryKey: ['workspace'] })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewModal && (
        <NewPanelModal
          existingCount={panels.length}
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
