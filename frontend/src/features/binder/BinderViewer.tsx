import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { ChevronLeft, ChevronRight, Crown, Star, Share2, Sparkles } from 'lucide-react';

const TABS = [
  { id: 'showcase',   label: 'Showcase',     color: 'bg-amber-500',   icon: Crown },
  { id: 'collection', label: 'Collection',   color: 'bg-blue-500',    icon: Star },
  { id: 'trading',    label: 'Trading Away', color: 'bg-emerald-500', icon: Share2 },
  { id: 'looking',    label: 'Looking For',  color: 'bg-rose-500',    icon: Sparkles },
];

const EMPTY_PAGE = Array<null>(9).fill(null);

const BINDER_PAGES: Record<string, { left: null[]; right: null[] }> = {
  showcase:   { left: EMPTY_PAGE, right: EMPTY_PAGE },
  collection: { left: EMPTY_PAGE, right: EMPTY_PAGE },
  trading:    { left: EMPTY_PAGE, right: EMPTY_PAGE },
  looking:    { left: EMPTY_PAGE, right: EMPTY_PAGE },
};

export default function BinderViewer() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flippingToIndex, setFlippingToIndex] = useState<number | null>(null);

  const rotateY = useMotionValue(0);

  const A_index = isFlipping && flippingToIndex !== null ? Math.min(activeIndex, flippingToIndex) : activeIndex;
  const B_index = isFlipping && flippingToIndex !== null ? Math.max(activeIndex, flippingToIndex) : activeIndex;

  const frontShadowOpacity = useTransform(rotateY, [0, -90], [0, 0.25]);
  const backShadowOpacity  = useTransform(rotateY, [-90, -180], [0.25, 0]);
  const rightStaticShadow  = useTransform(rotateY, [0, -90], [0.15, 0]);
  const leftStaticShadow   = useTransform(rotateY, [-90, -180], [0, 0.15]);

  const handleTabClick = async (index: number) => {
    if (index === activeIndex || isFlipping) return;
    setIsFlipping(true);
    setFlippingToIndex(index);
    const forward = index > activeIndex;
    rotateY.set(forward ? 0 : -180);
    await animate(rotateY, forward ? -180 : 0, { duration: 0.8, ease: [0.45, 0, 0.55, 1] });
    setActiveIndex(index);
    setFlippingToIndex(null);
    setIsFlipping(false);
  };

  const handlePanEnd = (_e: PointerEvent, info: { offset: { x: number } }) => {
    if (isFlipping) return;
    const SWIPE_THRESHOLD = 50;
    if (info.offset.x < -SWIPE_THRESHOLD && activeIndex < TABS.length - 1) handleTabClick(activeIndex + 1);
    else if (info.offset.x > SWIPE_THRESHOLD && activeIndex > 0) handleTabClick(activeIndex - 1);
  };

  return (
    <motion.div
      onPanEnd={handlePanEnd}
      className="relative w-full max-w-[1100px] h-[560px] flex items-center justify-center cursor-grab active:cursor-grabbing"
      style={{ perspective: 2500 }}
    >
      <div className="relative w-full h-full flex [transform-style:preserve-3d]">

        {/* STATIC LEFT PAGE */}
        <div className="w-1/2 h-full relative z-10">
          <Page items={BINDER_PAGES[TABS[A_index].id].left} side="left" interactive={!isFlipping} />
          {isFlipping && (
            <motion.div className="absolute inset-0 bg-black pointer-events-none rounded-l-md" style={{ opacity: leftStaticShadow }} />
          )}
          {activeIndex > 0 && !isFlipping && (
            <div
              className="absolute bottom-0 left-0 w-24 h-24 cursor-pointer group z-40"
              onClick={(e) => { e.stopPropagation(); handleTabClick(activeIndex - 1); }}
            >
              <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-2 backdrop-blur-sm shadow-xl">
                <ChevronLeft className="w-6 h-6" />
              </div>
            </div>
          )}
        </div>

        {/* STATIC RIGHT PAGE */}
        <div className="w-1/2 h-full relative z-10">
          <Page items={BINDER_PAGES[TABS[B_index].id].right} side="right" interactive={!isFlipping} />
          {isFlipping && (
            <motion.div className="absolute inset-0 bg-black pointer-events-none rounded-r-md" style={{ opacity: rightStaticShadow }} />
          )}
          {activeIndex < TABS.length - 1 && !isFlipping && (
            <div
              className="absolute bottom-0 right-0 w-24 h-24 cursor-pointer group z-40"
              onClick={(e) => { e.stopPropagation(); handleTabClick(activeIndex + 1); }}
            >
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-2 backdrop-blur-sm shadow-xl">
                <ChevronRight className="w-6 h-6" />
              </div>
            </div>
          )}
        </div>

        {/* FLIPPING PAGE */}
        {isFlipping && (
          <motion.div
            style={{ rotateY, transformStyle: 'preserve-3d' }}
            className="absolute top-0 right-0 w-1/2 h-full z-50 origin-left pointer-events-none"
          >
            <div className="absolute inset-0 [backface-visibility:hidden]">
              <Page items={BINDER_PAGES[TABS[A_index].id].right} side="right" interactive={false} />
              <motion.div className="absolute inset-0 bg-black pointer-events-none rounded-r-md" style={{ opacity: frontShadowOpacity }} />
            </div>
            <div className="absolute inset-0 [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)' }}>
              <Page items={BINDER_PAGES[TABS[B_index].id].left} side="left" interactive={false} />
              <motion.div className="absolute inset-0 bg-black pointer-events-none rounded-l-md" style={{ opacity: backShadowOpacity }} />
            </div>
          </motion.div>
        )}

        {/* Side Tabs */}
        <div className="absolute -right-14 top-12 flex flex-col gap-2 z-0">
          {TABS.map((tab, idx) => {
            const isActive = activeIndex === idx;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={(e) => { e.stopPropagation(); handleTabClick(idx); }}
                className={`
                  relative h-16 rounded-r-xl transition-all duration-300 flex items-center justify-center
                  border-y border-r border-black/20 shadow-[4px_0_10px_rgba(0,0,0,0.1)] group
                  ${isActive ? 'w-16 z-10 opacity-100 translate-x-2' : 'w-12 hover:w-14 z-0 opacity-80 hover:opacity-100'}
                  ${tab.color}
                `}
                title={tab.label}
              >
                <span className="absolute left-0 top-0 bottom-0 w-4 bg-black/10 mix-blend-overlay" />
                <Icon className={`w-5 h-5 text-white drop-shadow-sm ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`} />
              </button>
            );
          })}
        </div>

        {/* Binder Spine & Metal Rings */}
        <div className="absolute left-1/2 top-0 bottom-0 w-14 -ml-7 z-50 flex flex-col pointer-events-none">
          <div className="absolute inset-x-2 top-6 bottom-6 bg-gradient-to-r from-[#b3b6ba] via-[#f8f9fa] to-[#a1a5ab] rounded-sm shadow-[0_6px_20px_rgba(0,0,0,0.3),inset_0_1px_3px_rgba(255,255,255,0.9),inset_0_-1px_3px_rgba(0,0,0,0.2)] border-x border-[#9ca3af]">
            <div className="absolute left-1/2 top-0 bottom-0 w-1.5 -ml-[3px] bg-black/10 shadow-[inset_0_0_4px_rgba(0,0,0,0.3)] rounded-full" />
          </div>
          <div className="absolute inset-x-0 top-6 bottom-6 flex flex-col justify-evenly items-center">
            {[1, 2, 3].map((ring) => (
              <div key={ring} className="relative w-20 h-16 flex items-center justify-center -ml-[4px]">
                <div className="absolute w-16 h-12 rounded-full border-[6px] border-black/30 blur-[3px] translate-y-3 translate-x-1" />
                <svg width="70" height="60" viewBox="0 0 70 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-50 drop-shadow-[0_4px_6px_rgba(0,0,0,0.4)]">
                  <defs>
                    <linearGradient id={`ringGrad-${ring}`} x1="0" y1="0" x2="70" y2="60" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#d1d5db" />
                      <stop offset="25%" stopColor="#ffffff" />
                      <stop offset="50%" stopColor="#9ca3af" />
                      <stop offset="75%" stopColor="#e5e7eb" />
                      <stop offset="100%" stopColor="#4b5563" />
                    </linearGradient>
                    <linearGradient id={`ringHighlight-${ring}`} x1="35" y1="0" x2="35" y2="60" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                      <stop offset="20%" stopColor="#ffffff" stopOpacity="0" />
                      <stop offset="80%" stopColor="#000000" stopOpacity="0" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M35 55C16.7746 55 5 43.8071 5 30C5 16.1929 16.7746 5 35 5C53.2254 5 65 16.1929 65 30C65 43.8071 53.2254 55 35 55Z"
                    stroke={`url(#ringGrad-${ring})`} strokeWidth="7" strokeLinecap="round"
                  />
                  <path
                    d="M35 55C16.7746 55 5 43.8071 5 30C5 16.1929 16.7746 5 35 5C53.2254 5 65 16.1929 65 30C65 43.8071 53.2254 55 35 55Z"
                    stroke={`url(#ringHighlight-${ring})`} strokeWidth="7" strokeLinecap="round"
                    style={{ mixBlendMode: 'overlay' }}
                  />
                  <path d="M35 2 35 58" stroke="#1f2937" strokeWidth="2.5" />
                  <path d="M33.5 2 33.5 58" stroke="#ffffff" strokeWidth="1" opacity="0.5" />
                </svg>
                <div className="absolute left-1/2 ml-[2px] w-5 h-8 bg-gradient-to-r from-zinc-400 via-zinc-200 to-zinc-500 rounded-sm shadow-[0_3px_5px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.9)] -z-10" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

function Page({ items, side, interactive }: { items: null[]; side: 'left' | 'right'; interactive: boolean }) {
  return (
    <div className={`
      w-full h-full bg-[#fdfbf7] flex flex-col relative
      ${side === 'left' ? 'rounded-l-lg border-y border-l' : 'rounded-r-lg border-y border-r'}
      border-[#d1d5db] shadow-[0_8px_24px_rgba(0,0,0,0.12)]
    `}>
      <div
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cream-paper.png")' }}
      />
      <div className={`
        absolute ${side === 'left' ? 'right-0' : 'left-0'} top-0 bottom-0 w-2
        ${side === 'left' ? 'bg-gradient-to-l' : 'bg-gradient-to-r'}
        from-[#e5e7eb] to-transparent pointer-events-none z-20
      `} />
      <div className={`absolute ${side === 'left' ? 'right-0 bg-gradient-to-l' : 'left-0 bg-gradient-to-r'} top-0 bottom-0 w-16 from-black/10 to-transparent pointer-events-none z-20`} />
      <div className="relative z-30 p-6 md:p-10 h-full flex flex-col overflow-hidden">
        <PageContent items={items} interactive={interactive} />
      </div>
    </div>
  );
}

function PageContent({ items: _items, interactive: _interactive }: { items: null[]; interactive: boolean }) {
  return (
    <div className="w-full h-full relative flex items-center justify-center">
      <div className="w-full h-full bg-white/20 rounded-xl border-[1.5px] border-white/40 shadow-[0_4px_15px_rgba(0,0,0,0.03),inset_0_0_20px_rgba(255,255,255,0.5)] p-2 md:p-3 relative">
        <div className="grid grid-cols-3 grid-rows-3 gap-0 h-full relative z-10 border border-white/30 rounded-[6px] overflow-hidden bg-black/[0.02]">
          {Array.from({ length: 9 }).map((_, i) => {
            const isRightCol = i % 3 === 2;
            const isBottomRow = i >= 6;
            return (
              <div
                key={i}
                className={`
                  w-full h-full flex items-center justify-center relative z-10 overflow-hidden
                  ${!isRightCol ? 'border-r border-white/40' : ''}
                  ${!isBottomRow ? 'border-b border-white/40' : ''}
                `}
              >
                <div className="absolute inset-0 border-[1px] border-black/5 pointer-events-none mix-blend-overlay" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/5 opacity-40 pointer-events-none z-20" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
