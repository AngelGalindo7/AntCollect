import type { PostReferenceContent, TradeContextContent } from '@/features/trading/types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface PostEmbedCardProps {
  content: string;
  contentType: 'post_reference' | 'trade_context';
  isOwn: boolean;
}

export default function PostEmbedCard({ content, contentType, isOwn }: PostEmbedCardProps) {
  if (contentType === 'post_reference') {
    return <PostReferenceCard raw={content} isOwn={isOwn} />;
  }
  return <TradeContextCard raw={content} isOwn={isOwn} />;
}

// ── PostReferenceCard ─────────────────────────────────────────────────────────

function PostReferenceCard({ raw, isOwn }: { raw: string; isOwn: boolean }) {
  let data: PostReferenceContent | null = null;
  try {
    data = JSON.parse(raw) as PostReferenceContent;
  } catch {
    return <EmbedFallback isOwn={isOwn} />;
  }

  const thumbUrl = data.thumbnailPath ? `${BACKEND_URL}/${data.thumbnailPath}` : null;

  return (
    <div className={`rounded-xl border overflow-hidden max-w-xs ${isOwn ? 'border-blue-300 bg-blue-400/10' : 'border-gray-200 bg-white'}`}>
      {thumbUrl && (
        <img src={thumbUrl} alt={data.caption ?? `Post ${data.postId}`} className="w-full h-32 object-cover" />
      )}
      <div className="px-3 py-2 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Post</p>
        <p className="text-sm font-medium text-gray-800 line-clamp-2">{data.caption || 'Untitled'}</p>
        <p className="text-xs text-gray-500">@{data.ownerUsername}</p>
      </div>
    </div>
  );
}

// ── TradeContextCard ──────────────────────────────────────────────────────────

function TradeContextCard({ raw, isOwn }: { raw: string; isOwn: boolean }) {
  let data: TradeContextContent | null = null;
  try {
    data = JSON.parse(raw) as TradeContextContent;
  } catch {
    return <EmbedFallback isOwn={isOwn} />;
  }

  const thumbUrl = data.postThumbnail ? `${BACKEND_URL}/${data.postThumbnail}` : null;
  const label =
    data.type === 'WANT_TO_TRADE' ? 'Wants to trade for' : 'Has what you need';

  return (
    <div className={`rounded-xl border overflow-hidden max-w-xs ${isOwn ? 'border-blue-300 bg-blue-400/10' : 'border-gray-200 bg-white'}`}>
      {thumbUrl && (
        <img src={thumbUrl} alt={data.postCaption ?? `Post ${data.targetPostId}`} className="w-full h-32 object-cover" />
      )}
      <div className="px-3 py-2 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">Trade</p>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-800 line-clamp-2">{data.postCaption || 'Untitled'}</p>
        {data.offeredFolderId && data.offeredFolderName && (
          <p className="text-xs text-gray-500">
            Offering:{' '}
            <a href={`/folders/${data.offeredFolderId}`} className="text-blue-500 hover:underline">
              {data.offeredFolderName}
            </a>
          </p>
        )}
        <p className="text-xs text-gray-400">
          {data.requesterUsername} → {data.recipientUsername}
        </p>
      </div>
    </div>
  );
}

// ── Fallback ──────────────────────────────────────────────────────────────────

function EmbedFallback({ isOwn }: { isOwn: boolean }) {
  return (
    <span className={`italic text-xs ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
      [Post embed unavailable]
    </span>
  );
}
