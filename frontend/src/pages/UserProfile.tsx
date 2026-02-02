import React, { useEffect, useState } from "react";
import PostGridLayout from "./PostGridLayout";
import type { Post, ProfileResponse } from "./Types";

const API_BASE = "http://localhost:8000";

/**
 * UserProfile Component
 * 
 * PURPOSE:
 * - Fetch user profile data from backend
 * - Display user profile with their posts
 * 
 * WORKFLOW:
 * 1. Fetch profile using user ID from localStorage
 * 2. Transform image paths to full URLs
 * 3. Pass data to PostGridLayout for display
 * 
 * COMPONENT HIERARCHY:
 * UserProfile (data fetching & user info)
 *   └── PostGridLayout (layout & positioning)
 *       └── PostCard (individual post)
 */

const UserProfile: React.FC = () => {
	const [profile, setProfile] = useState<ProfileResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [username, setUsername] = useState<string>("");

	// Fetch user profile from backend
	const fetchProfile = async () => {
		setLoading(true);
		try {
			const storedUsername = localStorage.getItem("username");
			const storedUserId = localStorage.getItem("userId");

			if (!storedUserId) {
				console.error("No user ID found");
				return;
			}

			if (storedUsername) {
				setUsername(storedUsername);
			}

			const res = await fetch(`${API_BASE}/users/get_user_`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ profile_id: Number(storedUserId) }),
			});

			if (!res.ok) {
				throw new Error(`Failed to load profile: ${res.status}`);
			}

			const data: ProfileResponse = await res.json();
			const transformedData = {
				...data,
				posts: data.posts.map((post) => ({
					...post,
					image_paths: post.image_paths.map((path) => {
						if (!path) return null;
						const parts = path.split(/\\|\//);
						const filename = parts[parts.length - 1];
						return `${API_BASE}/uploads/${encodeURIComponent(filename)}`;
					}),
				})),
			};

			setProfile(transformedData);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchProfile();
	}, []);

	// Handle post click
	const handlePostClick = (post: Post, imageIndex: number) => {
		// TODO: Implement post interaction logic
		// This could navigate to detail view, open modal, etc.
		console.log(`Clicked post ${post.post_id}, image index: ${imageIndex}`);
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

	return (
		<div className="w-full">
			{/* User Profile Header */}
			<div className="bg-white border-b border-gray-200 px-4 py-6">
				<div className="max-w-6xl mx-auto">
					<h1 className="text-3xl font-bold text-gray-900">{username}</h1>
					<p className="text-gray-600 mt-2">
						{profile.posts.length} {profile.posts.length === 1 ? "post" : "posts"}
					</p>
				</div>
			</div>

			{/* Posts Grid */}
			<PostGridLayout posts={profile.posts} onPostClick={handlePostClick} />
		</div>
	);
};

export default UserProfile;