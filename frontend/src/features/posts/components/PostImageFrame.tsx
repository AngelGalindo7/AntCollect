import React, { useMemo } from 'react';

interface PostImageFrameProps {
  src: string | null;
  alt: string;
  /** Original image width for aspect ratio calculations */
  originalWidth?: number;
  /** Original image height for aspect ratio calculations */
  originalHeight?: number;
  /** Additional classes for the container */
  className?: string;
  /** Overlays like TradeEntryButton */
  children?: React.ReactNode;
}

/**
 * Renders a standardized "stage" for post images.
 * 
 * DESIGN DECISIONS:
 * 1. Consistent Footprint: Uses a defined "Stage" size to ensure UI elements 
 *    (like TradeOfferPanel or Captions) remain stable regardless of image size.
 * 2. Aspect-Ratio Awareness: Dynamically adjusts the stage orientation (Landscape vs Portrait)
 *    based on provided dimensions to maximize visual impact.
 * 3. Safe Upscaling: Small images are centered in the stage rather than stretched,
 *    preserving quality while maintaining UI height.
 * 4. Extensibility: Component is decoupled from specific "Modal" logic via className 
 *    and children props.
 */
const PostImageFrame: React.FC<PostImageFrameProps> = ({
  src,
  alt,
  originalWidth,
  originalHeight,
  className = '',
  children,
}) => {
  // Determine if the stage should lean landscape or portrait
  const isLandscape = useMemo(() => {
    if (!originalWidth || !originalHeight) return false;
    return originalWidth > originalHeight;
  }, [originalWidth, originalHeight]);

  // Stage dimensions logic:
  // - We prioritize vertical height for "Stickers" but allow wider boxes for landscape shots.
  // - min-h-[400px] ensures the Trade Panel next to it is always functional.
  const stageStyles = isLandscape
    ? 'w-[min(90vw,700px)] h-[min(60vh,500px)]'
    : 'w-[min(85vw,500px)] h-[min(80vh,650px)]';

  return (
    <div
      className={`
        relative flex-shrink-0 
        flex items-center justify-center 
        bg-neutral-900/5 dark:bg-neutral-100/5 
        rounded-lg overflow-hidden shadow-2xl 
        transition-all duration-300 ease-in-out
        min-h-[400px]
        ${stageStyles}
        ${className}
      `.trim()}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          // 'object-contain' is the industry standard for "Gallery" views.
          // It ensures the entire image is visible without cropping, 
          // letterboxing it within our "Stage" if ratios don't match.
          className="max-w-full max-h-full w-auto h-auto object-contain block select-none"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-3">
          <svg className="w-16 h-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium uppercase tracking-wider">Image not found</span>
        </div>
      )}

      {/* Render overlay children (Buttons, Badges, etc) */}
      {children}
    </div>
  );
};

export default PostImageFrame;
