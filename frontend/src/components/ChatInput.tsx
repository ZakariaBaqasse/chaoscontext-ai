import { useRef, useState, useCallback } from "react";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24; // ~1.5rem
    const maxHeight = lineHeight * 5;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, []);

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    setValue((e.target as HTMLTextAreaElement).value);
    resize();
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const [focused, setFocused] = useState(false);
  const hasText = value.trim().length > 0;

  return (
    <div
      className="rounded-xl flex items-end gap-2 p-3"
      style={{
        backgroundColor: "var(--cc-bg-elevated)",
        border: `1px solid ${focused ? "rgba(255,130,5,0.55)" : "var(--cc-border)"}`,
        boxShadow: focused ? "0 0 0 3px rgba(255,130,5,0.10)" : "none",
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? "none" : "auto",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onInput={handleInput}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Ask about your project specs..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent outline-none text-base leading-6 placeholder:text-cc-text-muted"
        style={{
          color: "var(--cc-text-primary)",
          fontFamily: "var(--cc-font-sans)",
          minHeight: "24px",
          maxHeight: "120px",
          overflowY: "auto",
        }}
      />
      <button
        onClick={submit}
        disabled={!hasText || disabled}
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150"
        style={{
          backgroundColor: hasText ? "var(--cc-accent)" : "var(--cc-border)",
          color: hasText ? "#ffffff" : "var(--cc-text-muted)",
          cursor: hasText && !disabled ? "pointer" : "default",
        }}
        onMouseEnter={(e) => {
          if (hasText) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "var(--cc-accent-hover)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = hasText
            ? "var(--cc-accent)"
            : "var(--cc-border)";
        }}
      >
        <ArrowUp size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
