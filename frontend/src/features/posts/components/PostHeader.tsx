import React from 'react';
import { Link } from 'react-router-dom';

interface PostUser {
  username: string;
  avatar_path: string | null;
}

interface PostHeaderProps {
  user: PostUser | null | undefined;
}

const AvatarIcon: React.FC = () => (
  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  </div>
);

const PostHeader: React.FC<PostHeaderProps> = ({ user }) => {
  if (!user) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <AvatarIcon />
      </div>
    );
  }

  return (
    <Link
      to={`/${user.username}`}
      className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
      onClick={(e) => e.stopPropagation()}
    >
      {user.avatar_path ? (
        <img
          src={user.avatar_path}
          alt={user.username}
          className="w-7 h-7 rounded-full object-cover shrink-0"
        />
      ) : (
        <AvatarIcon />
      )}
      <span className="text-xs font-semibold text-gray-800 truncate">{user.username}</span>
    </Link>
  );
};

export default PostHeader;
