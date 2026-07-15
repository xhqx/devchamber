import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModelMultiSelect, generateInstanceId, type ModelSelectionWithId } from '@/components/multirun/ModelMultiSelect';
import { toast } from '@/components/ui';
import { updateDesktopSettings } from '@/lib/persistence';
import type { ForkFeatureSettings } from '@/lib/forkFeatures';
import { normalizeForkFeatureSettings } from '@/lib/forkFeatures';
import type { ModelFallbackChain, ModelFallbackPurpose, ModelFallbackRetryReason, ModelRef } from '@/lib/modelFallback';
import { DEFAULT_MODEL_FALLBACK_RETRY_ON, MODEL_FALLBACK_PURPOSES } from '@/lib/modelFallback';
import { useConfigStore } from '@/stores/useConfigStore';
import { filterVisibleAgents } from '@/stores/useAgentsStore';

const parseCsv = (value: string): string[] => Array.from(new Set(value
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)));

const formatCsv = (value: string[]): string => value.join(', ');

const persistForkFeatures = async (features: ForkFeatureSettings) => {
  await updateDesktopSettings({ forkFeatures: normalizeForkFeatureSettings(features) });
};

const PURPOSE_LABELS: Record<ModelFallbackPurpose, string> = {
  chat: 'Chat',
  commit: 'Commit generation',
  pr: 'PR summaries',
  autocomplete: 'Code autocomplete',
  docs: 'Docs/change notes',
};

const RETRY_REASON_LABELS: Record<ModelFallbackRetryReason, string> = {
  timeout: 'Timeout',
  rate_limit: 'Rate limit',
  server_error: 'Server error',
  invalid_json: 'Invalid JSON',
};

const modelKey = (model: Pick<ModelRef, 'providerID' | 'modelID'>): string => `${model.providerID}/${model.modelID}`;

const ToggleRow: React.FC<{
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}> = ({ checked, label, description, onChange }) => (
  <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3 hover:bg-interactive-hover">
    <Checkbox checked={checked} onChange={onChange} ariaLabel={label} />
    <span className="min-w-0 space-y-0.5">
      <span className="block typography-ui-label font-medium text-foreground">{label}</span>
      <span className="block typography-meta text-muted-foreground">{description}</span>
    </span>
  </label>
);

type DevChamberFeatureSettingsSection = 'agents' | 'workspace' | 'commit' | 'autoApprove';

type DevChamberFeatureSettingsProps = {
  sections?: DevChamberFeatureSettingsSection[];
};

const FallbackModelPicker: React.FC<{
  chain: ModelFallbackChain;
  knownModelLabels: Map<string, string>;
  onModelsChange: (models: ModelRef[]) => void;
  onMaxAttemptsChange: (maxAttempts: number) => void;
  onRetryReasonToggle: (reason: ModelFallbackRetryReason, checked: boolean) => void;
}> = ({ chain, knownModelLabels, onModelsChange, onMaxAttemptsChange, onRetryReasonToggle }) => {
  const selectedModels = React.useMemo<ModelSelectionWithId[]>(() => chain.models.map((model, index) => ({
    providerID: model.providerID,
    modelID: model.modelID,
    variant: model.variant,
    displayName: knownModelLabels.get(modelKey(model)) ?? modelKey(model),
    instanceId: `${chain.purpose}-${index}-${modelKey(model)}`,
  })), [chain.models, chain.purpose, knownModelLabels]);

  const handleAdd = React.useCallback((model: ModelSelectionWithId) => {
    onModelsChange([...chain.models, { providerID: model.providerID, modelID: model.modelID, ...(model.variant ? { variant: model.variant } : {}) }]);
  }, [chain.models, onModelsChange]);

  const handleRemove = React.useCallback((index: number) => {
    onModelsChange(chain.models.filter((_, modelIndex) => modelIndex !== index));
  }, [chain.models, onModelsChange]);

  const handleUpdate = React.useCallback((index: number, model: ModelSelectionWithId) => {
    const next = chain.models.slice();
    next[index] = { providerID: model.providerID, modelID: model.modelID, ...(model.variant ? { variant: model.variant } : {}) };
    onModelsChange(next);
  }, [chain.models, onModelsChange]);

  return (
    <div className="min-w-0 space-y-3 rounded-lg border border-border/40 bg-[var(--surface-background)] p-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <h6 className="typography-ui-label font-medium text-foreground">{PURPOSE_LABELS[chain.purpose]}</h6>
          <p className="typography-meta text-muted-foreground">Pick fallback models from configured providers, in retry order.</p>
        </div>
        <label className="flex min-w-0 items-center gap-2 typography-meta text-muted-foreground sm:shrink-0">
          Attempts
          <Input
            type="number"
            min={1}
            max={5}
            value={chain.maxAttempts}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) onMaxAttemptsChange(value);
            }}
            className="h-8 w-16 shrink-0"
          />
        </label>
      </div>
      <div className="min-w-0 overflow-hidden">
        <ModelMultiSelect
          selectedModels={selectedModels.map((model) => ({ ...model, instanceId: model.instanceId || generateInstanceId() }))}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onUpdate={handleUpdate}
          addButtonLabel="Add fallback model"
          dropdownSide="bottom"
          dropdownClassName="!z-[70]"
          addButtonClassName="max-w-full"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {DEFAULT_MODEL_FALLBACK_RETRY_ON.map((reason) => (
          <label key={reason} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border/30 px-2 py-1 typography-meta text-muted-foreground">
            <Checkbox
              checked={chain.retryOn.includes(reason)}
              onChange={(checked) => onRetryReasonToggle(reason, checked)}
              ariaLabel={`Retry on ${RETRY_REASON_LABELS[reason]}`}
            />
            {RETRY_REASON_LABELS[reason]}
          </label>
        ))}
      </div>
    </div>
  );
};

export const DevChamberFeatureSettings: React.FC<DevChamberFeatureSettingsProps> = ({ sections }) => {
  const visibleSections = React.useMemo(() => new Set<DevChamberFeatureSettingsSection>(sections ?? ['agents', 'workspace', 'commit', 'autoApprove']), [sections]);
  const settingsForkFeatures = useConfigStore((state) => state.settingsForkFeatures);
  const setSettingsForkFeatures = useConfigStore((state) => state.setSettingsForkFeatures);
  const agentList = useConfigStore((state) => state.agents);
  const providers = useConfigStore((state) => state.providers);
  const agents = React.useMemo(() => filterVisibleAgents(agentList), [agentList]);
  const [allowedToolsDraft, setAllowedToolsDraft] = React.useState(() => formatCsv(settingsForkFeatures.autoApprove.allowedTools));

  const knownModelLabels = React.useMemo(() => {
    const labels = new Map<string, string>();
    providers.forEach((provider) => {
      const providerModels = Array.isArray(provider.models) ? provider.models : [];
      providerModels.forEach((model) => {
        const modelID = typeof model.id === 'string' ? model.id : '';
        if (!modelID) return;
        const modelName = typeof model.name === 'string' && model.name.trim() ? model.name.trim() : modelID;
        labels.set(`${provider.id}/${modelID}`, `${modelName} · ${provider.name ?? provider.id}`);
      });
    });
    return labels;
  }, [providers]);

  React.useEffect(() => {
    setAllowedToolsDraft(formatCsv(settingsForkFeatures.autoApprove.allowedTools));
  }, [settingsForkFeatures.autoApprove.allowedTools]);

  const updateFeatures = React.useCallback((recipe: (current: ForkFeatureSettings) => ForkFeatureSettings) => {
    const next = normalizeForkFeatureSettings(recipe(settingsForkFeatures));
    setSettingsForkFeatures(next);
    void persistForkFeatures(next).catch((error) => {
      const message = error instanceof Error ? error.message : 'Failed to save DevChamber settings';
      toast.error(message);
    });
  }, [setSettingsForkFeatures, settingsForkFeatures]);

  const updateFallbackChain = React.useCallback((purpose: ModelFallbackPurpose, patchChain: (chain: ModelFallbackChain) => ModelFallbackChain) => {
    updateFeatures((current) => {
      const currentChain = current.modelFallback.chain.find((entry) => entry.purpose === purpose) ?? {
        purpose,
        models: [],
        maxAttempts: 1,
        retryOn: [...DEFAULT_MODEL_FALLBACK_RETRY_ON],
      };
      const nextChain = patchChain(currentChain);
      const otherChains = current.modelFallback.chain.filter((entry) => entry.purpose !== purpose);
      return {
        ...current,
        modelFallback: {
          ...current.modelFallback,
          chain: [...otherChains, nextChain].sort((a, b) => MODEL_FALLBACK_PURPOSES.indexOf(a.purpose) - MODEL_FALLBACK_PURPOSES.indexOf(b.purpose)),
        },
      };
    });
  }, [updateFeatures]);

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
    <div data-settings-item="devchamber.features" className="min-w-0 space-y-4 overflow-hidden">
      {visibleSections.has('agents') && (
      <section className="min-w-0 space-y-3 overflow-hidden rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3">
        <div className="space-y-1">
          <h4 className="typography-ui-label font-medium text-foreground">Agents and models</h4>
          <p className="typography-meta text-muted-foreground">Choose the autocomplete agent and keep model fallback with agent behavior.</p>
        </div>

        <ToggleRow
          checked={settingsForkFeatures.autocomplete.enabled}
          label="Code autocomplete"
          description="Show inline suggestions while editing code in VS Code."
          onChange={(checked) => updateFeatures((current) => ({
            ...current,
            autocomplete: { ...current.autocomplete, enabled: checked },
          }))}
        />

        <label className="block space-y-1">
          <span className="typography-meta text-muted-foreground">Autocomplete agent</span>
          <Select
            value={settingsForkFeatures.autocomplete.agentName ?? '__default'}
            onValueChange={(value) => updateFeatures((current) => ({
              ...current,
              autocomplete: {
                ...current.autocomplete,
                agentName: value === '__default' ? null : value,
              },
            }))}
          >
            <SelectTrigger className="h-8 w-full sm:w-64">
              <SelectValue>{settingsForkFeatures.autocomplete.agentName ?? 'Default active agent'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">Default active agent</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.name} value={agent.name}>{agent.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="typography-meta text-muted-foreground">Used by the VS Code inline autocomplete provider when set.</p>
        </label>

        <div className="space-y-3 border-t border-border/40 pt-3">
          <div className="space-y-1">
            <h5 className="typography-ui-label font-medium text-foreground">Model fallback</h5>
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
          <div className="space-y-3">
            {MODEL_FALLBACK_PURPOSES.map((purpose) => {
              const chain = settingsForkFeatures.modelFallback.chain.find((entry) => entry.purpose === purpose) ?? {
                purpose,
                models: [],
                maxAttempts: 1,
                retryOn: [...DEFAULT_MODEL_FALLBACK_RETRY_ON],
              };
              return (
                <FallbackModelPicker
                  key={purpose}
                  chain={chain}
                  knownModelLabels={knownModelLabels}
                  onModelsChange={(models) => updateFallbackChain(purpose, (current) => ({
                    ...current,
                    models,
                    maxAttempts: Math.max(1, Math.min(5, Math.max(current.maxAttempts, models.length || 1))),
                  }))}
                  onMaxAttemptsChange={(maxAttempts) => updateFallbackChain(purpose, (current) => ({
                    ...current,
                    maxAttempts,
                  }))}
                  onRetryReasonToggle={(reason, checked) => updateFallbackChain(purpose, (current) => {
                    const retryOn = checked
                      ? Array.from(new Set([...current.retryOn, reason]))
                      : current.retryOn.filter((entry) => entry !== reason);
                    return {
                      ...current,
                      retryOn: retryOn.length > 0 ? retryOn : [reason],
                    };
                  })}
                />
              );
            })}
          </div>
        </div>
      </section>
      )}

      {visibleSections.has('workspace') && (
      <section className="min-w-0 space-y-3 overflow-hidden rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3">
        <div className="space-y-1">
          <h4 className="typography-ui-label font-medium text-foreground">Workspace features</h4>
          <p className="typography-meta text-muted-foreground">Separate planning, repo, and documentation spaces.</p>
        </div>

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
      )}

      {visibleSections.has('commit') && (
      <section className="min-w-0 space-y-3 overflow-hidden rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3">
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
            className="h-8 w-full sm:w-32"
          />
        </label>
      </section>
      )}

      {visibleSections.has('autoApprove') && (
      <section className="min-w-0 space-y-3 overflow-hidden rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3">
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
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)]">
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
              className="h-8 w-full"
            />
          </label>
          <label className="block space-y-1">
            <span className="typography-meta text-muted-foreground">Allowed tools, comma-separated (* for all)</span>
            <Input
              value={allowedToolsDraft}
              onChange={(event) => setAllowedToolsDraft(event.target.value)}
              onBlur={handleAllowedToolsBlur}
              placeholder="*, bash, edit, write"
              className="h-8 w-full min-w-0 font-mono text-xs"
            />
          </label>
        </div>
      </section>
      )}

    </div>
  );
};
