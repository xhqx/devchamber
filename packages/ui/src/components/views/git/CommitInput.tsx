import React from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/useUIStore';
import { useI18n } from '@/lib/i18n';
import type { CommitSuggestion } from '@/lib/autocomplete/commitScopes';

interface CommitInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasTouchInput?: boolean;
  isMobile?: boolean;
  suggestions?: CommitSuggestion[];
  autocompleteEnabled?: boolean;
}

const MIN_HEIGHT = 38; // Single line height
const MAX_HEIGHT = 200;

export const CommitInput: React.FC<CommitInputProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  hasTouchInput = false,
  isMobile = false,
  suggestions = [],
  autocompleteEnabled = false,
}) => {
  const { t } = useI18n();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = React.useState(false);
  const inputSpellcheckEnabled = useUIStore((state) => state.inputSpellcheckEnabled);
  const showSuggestions = autocompleteEnabled && isFocused && !disabled && suggestions.length > 0;
  const applySuggestion = (suggestion: CommitSuggestion) => {
    onChange(suggestion.value);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // Auto-resize based on content (layout phase to avoid mount flicker)
  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const hadFocus = document.activeElement === textarea;

    const resize = () => {
      // Reset to baseline to measure content height from a stable line.
      textarea.style.height = `${MIN_HEIGHT}px`;
      const contentHeight = textarea.scrollHeight;
      const newHeight = Math.min(Math.max(contentHeight, MIN_HEIGHT), MAX_HEIGHT);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = contentHeight > MAX_HEIGHT ? 'auto' : 'hidden';

      if (contentHeight > MAX_HEIGHT && !hadFocus) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    };

    resize();
    const frameId = window.requestAnimationFrame(resize);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => window.setTimeout(() => setIsFocused(false), 120)}
        placeholder={placeholder ?? t('gitView.commit.messagePlaceholder')}
        rows={1}
        disabled={disabled}
        autoCorrect={hasTouchInput ? 'on' : 'off'}
        autoCapitalize={hasTouchInput ? 'sentences' : 'off'}
        spellCheck={isMobile || inputSpellcheckEnabled}
        className={cn(
          'w-full rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 typography-ui-label text-foreground placeholder:text-muted-foreground',
          'resize-none outline-none transition-[border-color,box-shadow] duration-150',
          'focus-visible:ring-2 focus-visible:ring-[var(--interactive-focus-ring)]',
          disabled && 'opacity-50'
        )}
        style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT }}
      />
      {showSuggestions ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border/70 bg-popover shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.value}
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left typography-ui-label text-popover-foreground hover:bg-accent"
              onMouseDown={(event) => {
                event.preventDefault();
                applySuggestion(suggestion);
              }}
            >
              <span className="truncate font-medium">{suggestion.value}</span>
              <span className="min-w-0 truncate typography-meta text-muted-foreground">{suggestion.detail ?? suggestion.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
