import { useState } from 'react';

export default function DangerTab() {
  const [confirmed, setConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const handleDelete = () => {
    setAttempted(true);
  };

  return (
    <div className="space-y-4">
      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
        <h3 className="text-sm font-semibold text-red-700 mb-1">Delete Account</h3>
        <p className="text-sm text-red-600">
          Permanently deletes your account, posts, and all associated data. This cannot be undone.
        </p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => { setConfirmed(e.target.checked); setAttempted(false); }}
          className="w-4 h-4 accent-red-500"
        />
        <span className="text-sm text-gray-700">I understand this is permanent and cannot be undone</span>
      </label>

      <button
        disabled={!confirmed}
        onClick={handleDelete}
        className="bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Delete Account
      </button>

      {attempted && (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Account deletion is not yet available. Contact support if you need your account removed.
        </p>
      )}
    </div>
  );
}
