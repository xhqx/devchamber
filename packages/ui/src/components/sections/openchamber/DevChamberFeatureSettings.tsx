import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui';
import { Icon } from '@/components/icon/Icon';
import { updateDesktopSettings } from '@/lib/persistence';
import type { ForkFeatureSettings } from '@/lib/forkFeatures';
import { normalizeForkFeatureSettings } from '@/lib/forkFeatures';
import type { ModelFallbackChain } from '@/lib/modelFallback';
import { useConfigStore } from '@/stores/useConfigStore';

const formatFallbackChain = (chain: ModelFallbackChain[]): string => JSON.stringify(chain, null, 2);

const parseCsv = (value: string): string[] => Array.from(new Set(value
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)));

const formatCsv = (value: string[]): string => value.join(', ');

const persistForkFeatures = async (features: ForkFeatureSettings) => {
  await updateDesktopSettings({ forkFeatures: normalizeForkFeatureSettings(features) });
};

const SectionHeader: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="space-y-1 px-1">
    <div className="flex items-center gap-2">
      <Icon name="code-box" className="h-4 w-4 text-muted-foreground" />
      <h3 className="typography-ui-header font-medium text-foreground">{title}</h3>
    </div>
    <p className="typography-meta text-muted-foreground">{description}</p>
  </div>
);

const ToggleRow: React.FC<{
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}> = ({ checked, label, description, onChange }) => (
  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3 hover:bg-interactive-hover">
    <Checkbox checked={checked} onChange={onChange} ariaLabel={label} />
    <span className="min-w-0 space-y-0.5">
      <span className="block typography-ui-label font-medium text-foreground">{label}</span>
      <span className="block typography-meta text-muted-foreground">{description}</span>
    </span>
  </label>
);

export const DevChamberFeatureSettings: React.FC = () => {
  const settingsForkFeatures = useConfigStore((state) => state.settingsForkFeatures);
  const setSettingsForkFeatures = useConfigStore((state) => state.setSettingsForkFeatures);
  const [fallbackChainDraft, setFallbackChainDraft] = React.useState(() => formatFallbackChain(settingsForkFeatures.modelFallback.chain));
  const [allowedToolsDraft, setAllowedToolsDraft] = React.useState(() => formatCsv(settingsForkFeatures.autoApprove.allowedTools));
  const [isSavingChain, setIsSavingChain] = React.useState(false);
  const [chainError, setChainError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFallbackChainDraft(formatFallbackChain(settingsForkFeatures.modelFallback.chain));
    setAllowedToolsDraft(formatCsv(settingsForkFeatures.autoApprove.allowedTools));
  }, [settingsForkFeatures]);

  const updateFeatures = React.useCallback((recipe: (current: ForkFeatureSettings) => ForkFeatureSettings) => {
    const next = normalizeForkFeatureSettings(recipe(settingsForkFeatures));
    setSettingsForkFeatures(next);
    void persistForkFeatures(next).catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to save DevChamber settings';
      toast.error(message);
    });
  }, [setSettingsForkFeatures, settingsForkFeatures]);

  const saveFallbackChain = React.useCallback(async () => {
    setIsSavingChain(true);
    setChainError(null);
    try {
      const parsed = JSON.parse(fallbackChainDraft) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('Fallback chain must be a JSON array.');
      }
      const next = normalizeForkFeatureSettings({
        ...settingsForkFeatures,
        modelFallback: {
          ...settingsForkFeatures.modelFallback,
          chain: parsed,
        },
      });
      setFallbackChainDraft(formatFallbackChain(next.modelFallback.chain));
      setSettingsForkFeatures(next);
      await persistForkFeatures(next);
      toast.success('Fallback chain saved');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid fallback chain JSON';
      setChainError(message);
      toast.error(message);
    } finally {
      setIsSavingChain(false);
    }
  }, [fallbackChainDraft, setSettingsForkFeatures, settingsForkFeatures]);

  const handleAllowedToolsBlur = () => {
    updateFeatures((current) => ({
      ...current,
      autoApprove: {
        ...current.autoApprove,
        allowedTools: parseCsv(allowedToolsDraft),
      },
    }));
  };

  return (
    <div data-settings-item="devchamber.features" className="space-y-4">
      <SectionHeader
        title="DevChamber features"
        description="Control fork-only agentic IDE behavior from the UI instead of editing raw configuration."
      />

      <section className="space-y-3 px-1">
        <ToggleRow
          checked={settingsForkFeatures.docs.requiredOnCodeChange}
          label="Require docs on code changes"
          description="Keep the documentation gate visible for commits that modify code."
          onChange={(checked) => updateFeatures((current) => ({
            ...current,
            docs: { ...current.docs, requiredOnCodeChange: checked },
          }))}
        />

        <ToggleRow
          checked={settingsForkFeatures.autocomplete.enabled}
          label="Commit autocomplete"
          description="Suggest commit text while composing Git messages."
          onChange={(checked) => updateFeatures((current) => ({
            ...current,
            autocomplete: { ...current.autocomplete, enabled: checked },
          }))}
        />

        <ToggleRow
          checked={settingsForkFeatures.repoIndex.enabled}
          label="Repository index"
          description="Allow DevChamber to use repo indexing features when available."
          onChange={(checked) => updateFeatures((current) => ({
            ...current,
            repoIndex: { ...current.repoIndex, enabled: checked },
          }))}
        />

        <ToggleRow
          checked={settingsForkFeatures.kanban.enabled}
          label="Kanban / sprint board"
          description="Enable fork planning board features for project work."
          onChange={(checked) => updateFeatures((current) => ({
            ...current,
            kanban: { ...current.kanban, enabled: checked },
          }))}
        />
      </section>

      <section className="space-y-3 rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3">
        <div className="space-y-1">
          <h4 className="typography-ui-label font-medium text-foreground">Commit generation</h4>
          <p className="typography-meta text-muted-foreground">Tune the generated commit summary budget and variants.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 typography-ui-label text-foreground">
          <Checkbox
            checked={settingsForkFeatures.commitGeneration.variantsEnabled}
            onChange={(checked) => updateFeatures((current) => ({
              ...current,
              commitGeneration: { ...current.commitGeneration, variantsEnabled: checked },
            }))}
            ariaLabel="Enable commit variants"
          />
          Generate commit variants
        </label>
        <label className="block space-y-1">
          <span className="typography-meta text-muted-foreground">Max files included</span>
          <Input
            type="number"
            min={1}
            max={300}
            value={settingsForkFeatures.commitGeneration.maxFiles}
            onChange={(event) => {
              const value = Number(event.target.value);
              updateFeatures((current) => ({
                ...current,
                commitGeneration: { ...current.commitGeneration, maxFiles: Number.isFinite(value) ? value : current.commitGeneration.maxFiles },
              }));
            }}
            className="h-8 w-32"
          />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3">
        <div className="space-y-1">
          <h4 className="typography-ui-label font-medium text-foreground">Auto-approve</h4>
          <p className="typography-meta text-muted-foreground">Configure the guarded automatic approval behavior for selected tools.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 typography-ui-label text-foreground">
          <Checkbox
            checked={settingsForkFeatures.autoApprove.enabled}
            onChange={(checked) => updateFeatures((current) => ({
              ...current,
              autoApprove: { ...current.autoApprove, enabled: checked },
            }))}
            ariaLabel="Enable auto-approve"
          />
          Enable auto-approve
        </label>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <label className="block space-y-1">
            <span className="typography-meta text-muted-foreground">Timeout, sec</span>
            <Input
              type="number"
              min={5}
              max={600}
              value={settingsForkFeatures.autoApprove.timeoutSeconds}
              onChange={(event) => {
                const value = Number(event.target.value);
                updateFeatures((current) => ({
                  ...current,
                  autoApprove: { ...current.autoApprove, timeoutSeconds: Number.isFinite(value) ? value : current.autoApprove.timeoutSeconds },
                }));
              }}
              className="h-8"
            />
          </label>
          <label className="block space-y-1">
            <span className="typography-meta text-muted-foreground">Allowed tools, comma-separated</span>
            <Input
              value={allowedToolsDraft}
              onChange={(event) => setAllowedToolsDraft(event.target.value)}
              onBlur={handleAllowedToolsBlur}
              placeholder="bash, edit, write"
              className="h-8 font-mono text-xs"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3">
        <div className="space-y-1">
          <h4 className="typography-ui-label font-medium text-foreground">Model fallback</h4>
          <p className="typography-meta text-muted-foreground">
            Define fallback model chains for chat, commit, PR, autocomplete, and docs purposes.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 typography-ui-label text-foreground">
          <Checkbox
            checked={settingsForkFeatures.modelFallback.enabled}
            onChange={(checked) => updateFeatures((current) => ({
              ...current,
              modelFallback: { ...current.modelFallback, enabled: checked },
            }))}
            ariaLabel="Enable model fallback"
          />
          Enable model fallback
        </label>
        <Textarea
          value={fallbackChainDraft}
          onChange={(event) => setFallbackChainDraft(event.target.value)}
          rows={10}
          className="w-full font-mono typography-meta bg-transparent"
          outerClassName="min-h-[180px]"
          placeholder={'[{ "purpose": "chat", "models": [{ "providerID": "openai", "modelID": "gpt-5.5" }], "maxAttempts": 1, "retryOn": ["timeout"] }]'}
        />
        {chainError ? <p className="typography-meta text-destructive">{chainError}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" onClick={saveFallbackChain} disabled={isSavingChain}>
            {isSavingChain ? 'Saving…' : 'Save fallback chain'}
          </Button>
          <p className="typography-meta text-muted-foreground">
            JSON is normalized on save; invalid purposes or empty models are dropped.
          </p>
        </div>
      </section>
    </div>
  );
};
