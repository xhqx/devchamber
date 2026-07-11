import React from 'react';
import { Icon } from '@/components/icon/Icon';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { runtimeFetch } from '@/lib/runtime-fetch';
import { invalidateSettingsCache } from '@/lib/persistence';

type ChatResponseViewMode = 'default' | 'visual';

type ChatResponseViewToggleProps = {
  className?: string;
  iconClassName?: string;
};

const saveChatResponseViewMode = async (mode: ChatResponseViewMode): Promise<void> => {
  const response = await runtimeFetch('/api/config/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(mode === 'visual'
      ? { responseStyleEnabled: true, responseStylePreset: 'visual' }
      : { responseStyleEnabled: false, responseStylePreset: 'visual' }),
  });

  if (!response.ok) {
    throw new Error('Failed to save response view mode');
  }
  invalidateSettingsCache();
};

export const ChatResponseViewToggle = React.memo<ChatResponseViewToggleProps>(({ className, iconClassName }) => {
  const { t } = useI18n();
  const [mode, setMode] = React.useState<ChatResponseViewMode>('default');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
      try {
        const response = await runtimeFetch('/api/config/settings', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: abort.signal,
        });
        if (!response.ok) return;
        const settings = await response.json().catch(() => null) as {
          responseStyleEnabled?: unknown;
          responseStylePreset?: unknown;
        } | null;
        setMode(settings?.responseStyleEnabled === true && settings.responseStylePreset === 'visual'
          ? 'visual'
          : 'default');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.warn('[ChatResponseViewToggle] Failed to load response view mode:', error);
        }
      }
    };
    void load();
    return () => abort.abort();
  }, []);

  const updateMode = React.useCallback(async (nextMode: ChatResponseViewMode) => {
    if (nextMode === mode || isSaving) return;
    const previousMode = mode;
    setMode(nextMode);
    setIsSaving(true);
    try {
      await saveChatResponseViewMode(nextMode);
    } catch (error) {
      console.warn('[ChatResponseViewToggle] Failed to save response view mode:', error);
      setMode(previousMode);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, mode]);

  const isVisualMode = mode === 'visual';

  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60',
        isVisualMode && 'text-primary ring-1 ring-[color-mix(in_srgb,var(--primary-base)_28%,transparent)]',
        className,
      )}
      disabled={isSaving}
      aria-pressed={isVisualMode}
      aria-label={t(isVisualMode
        ? 'chat.responseStyleToggle.visualAria'
        : 'chat.responseStyleToggle.defaultAria')}
      title={t(isVisualMode
        ? 'chat.responseStyleToggle.visualTooltip'
        : 'chat.responseStyleToggle.defaultTooltip')}
      onClick={() => { void updateMode(isVisualMode ? 'default' : 'visual'); }}
    >
      <Icon name="apps-2-ai" className={cn('h-5 w-5', iconClassName)} />
    </button>
  );
});

ChatResponseViewToggle.displayName = 'ChatResponseViewToggle';
