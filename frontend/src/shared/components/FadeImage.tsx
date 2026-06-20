import { useLayoutEffect, useRef, useState } from 'react';

// Fades in from opacity-0 when the image finishes loading.
// useLayoutEffect catches browser-cache hits (complete=true before first paint)
// so cached images appear instantly without a visible flash.
export function FadeImage({
  style,
  onLoad,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  return (
    <img
      ref={imgRef}
      {...props}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: 'opacity 0.35s ease' }}
    />
  );
}
