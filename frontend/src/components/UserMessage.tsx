interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="flex justify-end w-full">
      <div
        className="max-w-[70%] rounded-xl px-4 py-3 text-base leading-relaxed break-words"
        style={{
          backgroundColor: "var(--cc-border)",
          color: "var(--cc-text-primary)",
          fontFamily: "var(--cc-font-sans)",
        }}
      >
        {content}
      </div>
    </div>
  );
}
