import React from 'react';

import { Icon } from '@/components/icon/Icon';
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';
import { cn } from '@/lib/utils';
import type { PromptAutocompleteSuggestion } from '@/lib/autocomplete/sources';
import { getNextAutocompleteIndex } from './menuState';

export interface AutocompleteMenuHandle {
  handleKeyDown: (key: string) => void;
}

export interface AutocompleteMenuProps {
  suggestions: PromptAutocompleteSuggestion[];
  onSelect: (suggestion: PromptAutocompleteSuggestion) => void;
  onClose: () => void;
  title?: string;
  emptyLabel?: string;
  style?: React.CSSProperties;
  className?: string;
}

const KIND_ICON: Record<PromptAutocompleteSuggestion['kind'], React.ComponentProps<typeof Icon>['name']> = {
  file: 'file',
  symbol: 'code',
  command: 'terminal',
  task: 'file-check',
};

const KIND_LABEL: Record<PromptAutocompleteSuggestion['kind'], string> = {
  file: 'File',
  symbol: 'Symbol',
  command: 'Command',
  task: 'Task',
};

export const AutocompleteMenu = React.forwardRef<AutocompleteMenuHandle, AutocompleteMenuProps>(({
  suggestions,
  onSelect,
  onClose,
  title = 'Autocomplete',
  emptyLabel = 'No suggestions',
  style,
  className,
}, ref) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const selectedIndexRef = React.useRef(0);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  React.useEffect(() => {
    setSelectedIndex(0);
    selectedIndexRef.current = 0;
  }, [suggestions]);

  React.useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const menu = itemRefs.current.find((item) => item?.contains(target));
      if (menu) return;
      const container = (event.currentTarget as Document).querySelector('[data-prompt-autocomplete-menu="true"]');
      if (container?.contains(target)) return;
      onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  React.useImperativeHandle(ref, () => ({
    handleKeyDown: (key: string) => {
      if (key === 'Escape') {
        onClose();
        return;
      }
      if (suggestions.length === 0) return;
      if (key === 'ArrowDown') {
        const next = getNextAutocompleteIndex(selectedIndexRef.current, suggestions.length, 1);
        selectedIndexRef.current = next;
        setSelectedIndex(next);
        return;
      }
      if (key === 'ArrowUp') {
        const next = getNextAutocompleteIndex(selectedIndexRef.current, suggestions.length, -1);
        selectedIndexRef.current = next;
        setSelectedIndex(next);
        return;
      }
      if (key === 'Enter' || key === 'Tab') {
        onSelect(suggestions[selectedIndexRef.current] ?? suggestions[0]);
      }
    },
  }), [onClose, onSelect, suggestions]);

  return (
    <ScrollableOverlay
      data-prompt-autocomplete-menu="true"
      className={cn(
        'absolute bottom-full left-0 z-50 mb-2 w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-xl',
        className,
      )}
      style={style}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="typography-ui-small font-medium text-popover-foreground">{title}</div>
        <div className="typography-ui-label text-muted-foreground">↑↓ Enter</div>
      </div>
      <div className="max-h-80 overflow-y-auto p-1">
        {suggestions.length === 0 ? (
          <div className="px-3 py-4 text-center typography-ui-small text-muted-foreground">{emptyLabel}</div>
        ) : suggestions.map((suggestion, index) => {
          const selected = index === selectedIndex;
          return (
            <button
              key={suggestion.id}
              ref={(node) => { itemRefs.current[index] = node; }}
              type="button"
              className={cn(
                'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                selected ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/70',
              )}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => onSelect(suggestion)}
            >
              <Icon name={KIND_ICON[suggestion.kind]} className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate typography-ui-small font-medium">{suggestion.label}</span>
                {suggestion.detail ? (
                  <span className="block truncate typography-ui-label text-muted-foreground">{suggestion.detail}</span>
                ) : null}
              </span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 typography-ui-label text-muted-foreground">
                {KIND_LABEL[suggestion.kind]}
              </span>
            </button>
          );
        })}
      </div>
    </ScrollableOverlay>
  );
});

AutocompleteMenu.displayName = 'AutocompleteMenu';
