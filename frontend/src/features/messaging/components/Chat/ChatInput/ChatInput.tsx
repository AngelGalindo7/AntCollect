interface ChatInputProps {
  conversationId: string;
  currentUserId: string;
}

export default function ChatInput(_props: ChatInputProps) {
  return (
        <div className="border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0">
      <div className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-full bg-gray-50 text-sm text-gray-400 select-none">
        Message...
      </div>
    </div>
  );
}
