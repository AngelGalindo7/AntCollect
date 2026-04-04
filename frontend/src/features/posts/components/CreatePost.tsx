import React, { useState } from 'react';
import { fetchWithAuth } from '@/shared/api/api';
const API_BASE = "http://localhost:8000";

const PostType = {
  LOOKING_FOR: "looking_for",
  COLLECTION: "collection",
  TRADING: "trading",
} as const;
type PostType = typeof PostType[keyof typeof PostType];

interface CreatePostProps {
  onSuccess?: () => void;
}

function CreatePost({ onSuccess }: CreatePostProps) {

    const [caption, setCaption] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [postType, setPostType] = useState<PostType>(PostType.COLLECTION);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        setFiles(Array.from(e.target.files));
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
    
    e.preventDefault();
    const formData = new FormData();

    formData.append('caption', caption);
    formData.append('is_published', 'true');
    formData.append('post_type', postType);
    
    files.forEach((file) => {
        formData.append('post_images', file);
    });

    try { 
        const response = await fetchWithAuth(`${API_BASE}/posts/upload-post`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });
    
    const text = await response.text();
    console.log('Response:', text); // See what you're actually getting
    
    setCaption('');
    setFiles([]);
    setPostType(PostType.COLLECTION);

    if (onSuccess) {
      onSuccess();
    }

    } catch (err) { 
        console.error('Upload error:', err);
    }
};


return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg p-6 bg-white rounded-lg border border-gray-200">
  

  <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Post Type</label>
            <select 
              value={postType}
              onChange={(e) => setPostType(e.target.value as PostType)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={PostType.COLLECTION}>Collection</option>
              <option value={PostType.LOOKING_FOR}>Looking For</option>
              <option value={PostType.TRADING}>Trading</option>
            </select>
          </div>

  <textarea 
    placeholder="Write a caption..." 
    value={caption}
    onChange={(e) => setCaption(e.target.value)}
    rows={3}
    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
  />
  
  <div>
    <input 
      type="file" 
      multiple
      accept="image/*"
      onChange={handleFileChange}
      id="file-upload"
      className="hidden"
    />
    <label 
      htmlFor="file-upload"
      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition"
    >
      <span className="text-sm text-gray-600">{files.length > 0 ? `${files.length} file(s) selected` : 'Click to upload images'}</span>
    </label>
  </div>
  
  <button 
    type="submit"
    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
  >
    Post
  </button>
</form>
)
}

export default CreatePost;
