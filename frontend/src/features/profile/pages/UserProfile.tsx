import React, { useEffect, useRef, useState } from "react";
import PostGridLayout from "@/features/posts/components/PostGridLayout";
import type { Post, ProfileResponse } from "@/shared/types/Types";
import Search from "@/features/search/components/Search";
import { fetchWithAuth } from "@/shared/api/api";
import { useParams } from "react-router-dom";

const API_BASE = "http://localhost:8000";

type TabValue = "collection" | "looking_for" | "trading";

const TABS: { label: string; value: TabValue }[] = [
  { label: "Collection", value: "collection" },
  { label: "Looking For", value: "looking_for" },
  { label: "Trading Away", value: "trading" },
];

const UserProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<TabValue>("collection");

  // Avatar upload state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sticker inline-edit state
  const [editingStickers, setEditingStickers] = useState(false);
  const [stickerDraft, setStickerDraft] = useState<number>(0);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetchWithAuth(`${API_BASE}/users/get_user_`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username: String(username) }),
        });

        if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);

        const data: ProfileResponse = await res.json();
        const transformedData: ProfileResponse = {
          ...data,
          posts: data.posts.map((post) => ({
            ...post,
            image_paths: (post as any).images
              ?.filter((img: any) => img && img.paths?.medium)
              .map((img: any) => `${API_BASE}/${img.paths.original}`) ?? [],
          })),
        };
        setProfile(transformedData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username, refreshKey]);

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
      // Reset so the same file can be re-selected if needed
      e.target.value = "";
    }
  };

  const handleStickerCommit = async (newValue: number) => {
    if (!profile || newValue === profile.sticker_count) {
      setEditingStickers(false);
      return;
    }
    const previous = profile.sticker_count;
    // Optimistic update
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

  const handlePostClick = (post: Post, imageIndex: number) => {
    console.log(`Clicked post ${post.post_id}, image index: ${imageIndex}`);
  };

  const handleLikeToggle = (postId: number, isLiked: boolean) => {
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        posts: prev.posts.map((post) => {
          if (post.post_id === postId) {
            return {
              ...post,
              is_liked: isLiked,
              total_likes: isLiked ? post.total_likes + 1 : post.total_likes - 1,
            };
          }
          return post;
        }),
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">No profile loaded</div>
      </div>
    );
  }

  const filteredPosts = profile.posts.filter((p) => p.type === activeTab);

  return (
    <div className="w-full">
      {/* ── Section 1: Profile header bar ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-start justify-between px-8 py-6 max-w-6xl mx-auto">
          {/* Left: avatar + info */}
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className={`w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center${uploading ? " opacity-50" : ""}`}
              >
                {profile.avatar_path ? (
                  <img
                    src={`${API_BASE}/${profile.avatar_path}`}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-semibold text-gray-500 select-none">
                    {profile.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {profile.is_owner && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold hover:bg-blue-600"
                    aria-label="Upload avatar"
                  >
                    +
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                </>
              )}
            </div>

            {/* Info + stats */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>

              {profile.bio ? (
                <p className="text-sm text-gray-500 mt-1">{profile.bio}</p>
              ) : profile.is_owner ? (
                <p className="text-sm text-gray-400 italic mt-1">No bio yet.</p>
              ) : null}

              {/* Stats row */}
              <div className="flex gap-4 mt-4">
                {/* Stickers stat */}
                <div className="flex flex-col items-center bg-gray-50 rounded-lg px-4 py-2 min-w-18">
                  <span className="text-xs text-gray-500 mb-1">Stickers</span>
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
                      className="w-16 text-center text-lg font-semibold text-gray-900 bg-transparent border-b border-blue-400 outline-none"
                    />
                  ) : (
                    <span
                      className={`text-lg font-semibold text-gray-900${profile.is_owner ? " cursor-pointer hover:text-blue-500" : ""}`}
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

                {/* Folders stat (visual placeholder) */}
                <div className="flex flex-col items-center bg-gray-50 rounded-lg px-4 py-2 min-w-18">
                  <span className="text-xs text-gray-500 mb-1">Folders</span>
                  <span className="text-lg font-semibold text-gray-900">0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: search */}
          <div className="shrink-0">
            <Search />
          </div>
        </div>
      </div>

      {/* ── Section 2: Tab bar ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-8">
          <div className="flex gap-6">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.value
                    ? "border-blue-500 text-blue-600 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2: Post grid ── */}
      <PostGridLayout
        posts={filteredPosts}
        onPostClick={handlePostClick}
        onLikeToggle={handleLikeToggle}
      />
    </div>
  );
};

export default UserProfile;
