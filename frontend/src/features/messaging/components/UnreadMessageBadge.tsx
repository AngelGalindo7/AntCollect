interface UnreadMessageBadgeProps {
  count: number;
  /** If true, renders inline next to an element (e.g. a message button).
   *  If false (default), renders as an absolute-positioned overlay dot. */
  inline?: boolean;
}

/**
 * Self-contained badge. Renders nothing when count is 0.
 * Display is capped at "99+".
 *
 * Usage — in NavBar / sidebar button:
 *   <UnreadMessageBadge count={unreadCount} inline />
 *
 * Usage — overlaid on an avatar/icon:
 *   <div className="relative">
 *     <Icon />
 *     <UnreadMessageBadge count={unreadCount} />
 *   </div>
 */
export function UnreadMessageBadge({ count, inline = false }: UnreadMessageBadgeProps) {
  if (count <= 0) return null;

  const label = count > 99 ? '99+' : String(count);

  if (inline) {
    return (
      <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
        {label}
      </span>
    );
  }

  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
      {label}
    </span>
  );
}
