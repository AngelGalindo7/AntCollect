import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CanvasEditorOverlay } from '@/features/workspace/components/CanvasEditorOverlay';
import { getMyWorkspace } from '@/features/workspace/api/workspaceApi';
import { getSession } from '@/shared/auth/session';
import { fetchPublic, API_BASE } from '@/shared/api/api';
import type { ProfileResponse } from '@/shared/types/Types';

export default function PanelEditorPage() {
  const { panelId } = useParams<{ panelId: string }>();
  const navigate = useNavigate();
  const session = getSession();

  const { data: workspaceData, isLoading: wsLoading } = useQuery({
    queryKey: ['workspace'],
    queryFn: getMyWorkspace,
  });

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', session?.username],
    queryFn: (): Promise<ProfileResponse> =>
      fetchPublic(`${API_BASE}/users/get_user_?include_unlisted=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: session?.username }),
      }).then((r) => r.json()),
    enabled: !!session?.username,
    staleTime: 5 * 60 * 1000,
  });

  const panel = workspaceData?.panels.find((p) => p.id === Number(panelId));
  const posts = profileData?.posts ?? [];

  if (wsLoading || profileLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-warm-cream">
        <span className="text-espresso/40 text-sm">Loading…</span>
      </div>
    );
  }

  if (!panel) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-warm-cream">
        <div className="text-center">
          <p className="text-espresso/60 text-sm">Canvas not found.</p>
          <button
            onClick={() => navigate('/studio')}
            className="mt-4 px-4 py-2 rounded-lg text-white text-sm font-semibold bg-campus-blue hover:opacity-90 transition-opacity"
          >
            Back to Studio
          </button>
        </div>
      </div>
    );
  }

  return (
    <CanvasEditorOverlay
      panel={panel}
      posts={posts}
      onClose={() => navigate('/studio')}
      onSaved={() => navigate('/studio')}
    />
  );
}
