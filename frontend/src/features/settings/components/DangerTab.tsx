import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';

export default function DangerTab() {
  const [confirmed, setConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4">
        <TriangleAlert size={18} className="shrink-0 text-red-500 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-700">Delete Account</p>
          <p className="mt-0.5 text-sm text-red-600/80">
            Permanently deletes your account, posts, and all associated data. This cannot be undone.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => { setConfirmed(e.target.checked); setAttempted(false); }}
          className="mt-0.5 w-4 h-4 accent-red-500 shrink-0"
        />
        <span className="text-sm text-espresso/70">
          I understand this is permanent and cannot be undone.
        </span>
      </label>

      <button
        disabled={!confirmed}
        onClick={() => setAttempted(true)}
        className="bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
      >
        Delete Account
      </button>

      {attempted && (
        <div className="rounded-xl border border-warm-gray bg-warm-gray/10 px-4 py-3">
          <p className="text-sm text-espresso/60">
            Account deletion is not yet available. Contact support if you need your account removed.
          </p>
        </div>
      )}
    </div>
  );
}
