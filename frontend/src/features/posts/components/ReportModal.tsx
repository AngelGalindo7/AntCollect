import React, { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { reportPost, type ReportReason } from '../api/reportApi';

interface ReportModalProps {
  postId: number;
  onClose: () => void;
}

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'copyright', label: 'Copyright Violation' },
  { value: 'other', label: 'Other' },
];

const ReportModal: React.FC<ReportModalProps> = ({ postId, onClose }) => {
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await reportPost(postId, selected);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold text-gray-900">Report Post</h2>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="py-4 text-center">
            <p className="text-gray-700 font-medium">Thank you for your report.</p>
            <p className="text-sm text-gray-500 mt-1">We'll review it shortly.</p>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="mt-4 px-5 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">Why are you reporting this post?</p>

            <div className="space-y-2">
              {REASONS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={selected === value}
                    onChange={() => setSelected(value)}
                    className="accent-red-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 mt-5">
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selected || loading}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
