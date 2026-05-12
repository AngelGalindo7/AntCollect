import React, { useEffect, useRef, useState } from "react";
import PostGridLayout from "@/features/posts/components/PostGridLayout";
import PostDetailModal from "@/features/posts/components/PostDetailModal";
import { Workspace } from "@/features/workspace/components/Workspace";
import { WorkspaceViewer } from "@/features/workspace/components/WorkspaceViewer";
import { PositionedBackgroundImage } from "@/shared/components/PositionedBackgroundImage";
import type { Folder, FolderType, GridItem, Post, ProfileResponse } from "@/shared/types/Types";
import { fetchPublic, fetchWithAuth, API_BASE } from "@/shared/api/api";
import { useParams, useNavigate, useLocation } from "react-router-dom";

type TabValue = "showcase" | "collection" | "looking_for" | "trading";
type ViewMode = "posts" | "folders";

const TABS: { label: string; value: TabValue }[] = [
  { label: "Showcase",     value: "showcase" },
  { label: "Collection",   value: "collection" },
  { label: "Looking For",  value: "looking_for" },
  { label: "Trading Away", value: "trading" },
];

function swapAvatarSize(path: string | null, size: 'medium' | 'original'): string | null {
  if (!path) return null;
  return path.replace('/thumbnail/', `/${size}/`);
}

const CameraIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const UserProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab = (location.state as { tab?: TabValue } | null)?.tab ?? "showcase";
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>("posts");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Avatar upload state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sticker inline-edit state
  const [editingStickers, setEditingStickers] = useState(false);
  const [stickerDraft, setStickerDraft] = useState<number>(0);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [profileRes, foldersRes] = await Promise.all([
          fetchPublic(`${API_BASE}/users/get_user_`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: String(username) }),
          }),
          fetchPublic(`${API_BASE}/folders/user/${username}`),
        ]);

        if (!profileRes.ok) throw new Error(`Failed to load profile: ${profileRes.status}`);

        const data: ProfileResponse = await profileRes.json();
        const postUser = {
          user_id: data.user_id,
          username: data.username,
          avatar_path: data.avatar_path,
        };
        const transformedData: ProfileResponse = {
          ...data,
          posts: data.posts.map((post) => ({
            ...post,
            image_paths: (post as any).images
              ?.filter((img: any) => img && img.paths?.medium)
              .map((img: any) => img.paths.original) ?? [],
            user: postUser,
          })),
        };
        setProfile(transformedData);

        if (foldersRes.ok) {
          const folderData: Folder[] = await foldersRes.json();
          setFolders(folderData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [username, refreshKey]);

  // Reset to showcase tab when navigating to a different profile,
  // unless an explicit tab was passed via navigation state (e.g. after deleting a folder)
  useEffect(() => {
    const fromState = (location.state as { tab?: TabValue } | null)?.tab;
    setActiveTab(fromState ?? "showcase");
    if (fromState) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [username]);

  // Reset sub-filter to posts whenever the active tab changes
  useEffect(() => {
    setViewMode("posts");
  }, [activeTab]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE}/users/me/avatar`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Avatar upload failed");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleStickerCommit = async (newValue: number) => {
    if (!profile || newValue === profile.sticker_count) {
      setEditingStickers(false);
      return;
    }
    const previous = profile.sticker_count;
    setProfile((p) => p ? { ...p, sticker_count: newValue } : p);
    setEditingStickers(false);
    try {
      const res = await fetchWithAuth(`${API_BASE}/users/me/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sticker_count: newValue }),
      });
      if (!res.ok) throw new Error("Failed to update sticker count");
    } catch (err) {
      console.error(err);
      setProfile((p) => p ? { ...p, sticker_count: previous } : p);
    }
  };

  const handlePostClick = (post: Post) => setSelectedPost(post);
  const handleFolderClick = (folder: Folder) => navigate(`/folders/${folder.id}`);

  const handleLikeToggle = (postId: number, isLiked: boolean) => {
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        posts: prev.posts.map((post) =>
          post.post_id === postId
            ? { ...post, is_liked: isLiked, total_likes: isLiked ? post.total_likes + 1 : post.total_likes - 1 }
            : post
        ),
      };
    });
  };

  const handlePostDelete = (postId: number) => {
    setProfile((prev) =>
      prev ? { ...prev, posts: prev.posts.filter((p) => p.post_id !== postId) } : prev
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-espresso/60">Loading…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-espresso/60">No profile loaded</div>
      </div>
    );
  }

  const tabFolderType: FolderType = activeTab !== "showcase" ? (activeTab as FolderType) : "collection";
  const filteredPosts = profile.posts.filter((p) => p.type === activeTab);
  const filteredFolders = folders.filter((f) => f.folder_type === activeTab);
  const gridItems: GridItem[] = viewMode === "folders"
    ? filteredFolders.map((f): GridItem => ({ kind: "folder", data: f }))
    : filteredPosts.map((p): GridItem => ({ kind: "post", data: p }));

  return (
    <div className="w-full">
      {/* ── Section 1: Profile header with background ── */}
      <div className="relative w-full overflow-hidden aspect-[6/1] min-h-[200px] bg-warm-gray/20">
        {profile.background_path && (
          <PositionedBackgroundImage
            src={profile.background_path}
            offsetX={profile.background_offset_x}
            offsetY={profile.background_offset_y}
            scale={profile.background_scale}
          />
        )}

        <div className="absolute inset-0 z-10 flex items-start gap-6 px-4 py-8 max-w-6xl mx-auto">
          <div className="shrink-0">
            {profile.is_owner ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`group relative w-24 h-24 rounded-full ring-4 ring-white overflow-hidden bg-warm-cream flex items-center justify-center${uploading ? " opacity-50" : ""}`}
                aria-label="Upload avatar"
              >
                {profile.avatar_path ? (
                  <img
                    src={swapAvatarSize(profile.avatar_path, 'medium') ?? ''}
                    srcSet={`${swapAvatarSize(profile.avatar_path, 'original')} 2x`}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-semibold text-espresso/50 select-none">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <CameraIcon className="w-7 h-7 text-white" />
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
              </button>
            ) : (
              <div className="w-24 h-24 rounded-full ring-4 ring-white overflow-hidden bg-warm-cream flex items-center justify-center">
                {profile.avatar_path ? (
                  <img
                    src={swapAvatarSize(profile.avatar_path, 'medium') ?? ''}
                    srcSet={`${swapAvatarSize(profile.avatar_path, 'original')} 2x`}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-semibold text-espresso/50 select-none">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <h1 className="bg-white/60 rounded-md px-2 py-0.5 w-fit text-2xl font-bold text-espresso">
              {profile.username}
            </h1>

            {profile.bio ? (
              <p className="bg-white/60 rounded-md px-2 py-0.5 w-fit text-sm text-espresso/70">
                {profile.bio}
              </p>
            ) : profile.is_owner ? (
              <p className="bg-white/60 rounded-md px-2 py-0.5 w-fit text-sm text-espresso/40 italic">
                No bio yet.
              </p>
            ) : null}

            <div className="flex items-center gap-3 flex-wrap" data-testid="profile-stats">
              <div className="flex flex-col items-center bg-white/60 rounded-md px-2 py-0.5">
                <span className="text-xs text-espresso/60">Stickers</span>
                {profile.is_owner && editingStickers ? (
                  <input
                    type="number"
                    min={0}
                    value={stickerDraft}
                    onChange={(e) => setStickerDraft(Number(e.target.value))}
                    onBlur={() => handleStickerCommit(stickerDraft)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleStickerCommit(stickerDraft);
                      if (e.key === "Escape") setEditingStickers(false);
                    }}
                    autoFocus
                    className="w-16 text-center text-sm font-semibold text-espresso border-b border-uci-gold outline-none bg-transparent"
                  />
                ) : (
                  <span
                    className={`text-sm font-semibold text-espresso${profile.is_owner ? " cursor-pointer hover:text-uci-gold" : ""}`}
                    onClick={() => {
                      if (!profile.is_owner) return;
                      setStickerDraft(profile.sticker_count);
                      setEditingStickers(true);
                    }}
                  >
                    {profile.sticker_count}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-center bg-white/60 rounded-md px-2 py-0.5">
                <span className="text-xs text-espresso/60">Folders</span>
                <span className="text-sm font-semibold text-espresso">{folders.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Tab bar ── */}
      <div className="border-b border-warm-gray">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-6">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.value
                    ? "border-uci-gold text-espresso font-bold"
                    : "border-transparent text-espresso/50 hover:text-espresso"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 3: Tab content ── */}
      {activeTab === "showcase" ? (
        <div className="max-w-6xl mx-auto w-full px-6 py-4">
          {profile.is_owner ? (
            <Workspace username={String(username)} posts={profile.posts} isOwner={true} />
          ) : (
            <WorkspaceViewer username={String(username)} />
          )}
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 mt-6">
          <div className="mb-4 inline-flex rounded-full bg-warm-cream p-1">
            {(["posts", "folders"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors capitalize ${
                  viewMode === mode
                    ? "bg-white text-espresso shadow-sm"
                    : "text-espresso/60 hover:text-espresso"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <PostGridLayout
            items={gridItems}
            onPostClick={handlePostClick}
            onLikeToggle={handleLikeToggle}
            onPostDelete={handlePostDelete}
            onFolderClick={handleFolderClick}
            folderType={tabFolderType}
            postOwnerId={profile.user_id}
          />
        </div>
      )}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onDeleteSuccess={() => {
            handlePostDelete(selectedPost.post_id);
            setSelectedPost(null);
          }}
          postOwnerId={profile.user_id}
          folderType={tabFolderType}
        />
      )}

    </div>
  );
};

export default UserProfile;
