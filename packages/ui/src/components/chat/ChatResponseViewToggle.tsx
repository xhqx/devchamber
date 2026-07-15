import React from 'react';
import { Icon } from '@/components/icon/Icon';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { fetchResponseStyleSettings } from '@/lib/responseStyle';
import { updateDesktopSettings } from '@/lib/persistence';
import { toast } from '@/components/ui/toast';

type ChatResponseViewMode = 'default' | 'visual';

type ChatResponseViewToggleProps = {
  className?: string;
  iconClassName?: string;
};

const saveChatResponseViewMode = async (mode: ChatResponseViewMode): Promise<void> => {
  await updateDesktopSettings(mode === 'visual'
    ? { responseStyleEnabled: true, responseStylePreset: 'visual' }
    : { responseStyleEnabled: false, responseStylePreset: 'visual' });
};

export const ChatResponseViewToggle = React.memo<ChatResponseViewToggleProps>(({ className, iconClassName }) => {
  const { t } = useI18n();
  const [mode, setMode] = React.useState<ChatResponseViewMode>('default');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        const settings = await fetchResponseStyleSettings();
        if (disposed) return;
        setMode(settings?.enabled === true && settings.preset === 'visual'
          ? 'visual'
          : 'default');
      } catch (error) {
        if (!disposed) {
          console.warn('[ChatResponseViewToggle] Failed to load response view mode:', error);
        }
      }
    };
    void load();
    return () => { disposed = true; };
  }, []);

  const updateMode = React.useCallback(async (nextMode: ChatResponseViewMode) => {
    if (nextMode === mode || isSaving) return;
    const previousMode = mode;
    setMode(nextMode);
    setIsSaving(true);
    try {
      await saveChatResponseViewMode(nextMode);
      toast.success(nextMode === 'visual' ? 'Visual response mode enabled' : 'Visual response mode disabled');
    } catch (error) {
      console.warn('[ChatResponseViewToggle] Failed to save response view mode:', error);
      toast.error('Failed to save response mode');
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
        'chat-response-view-toggle inline-flex h-9 w-9 items-center justify-center p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60',
        isVisualMode && 'chat-response-view-toggle--visual text-primary',
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
