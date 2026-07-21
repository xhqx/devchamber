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
import { DEFAULT_MODEL_FALLBACK_RETRY_ON } from '@/lib/modelFallback';
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
  auth_error: 'Authentication/API key error',
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

const AgentSelectRow: React.FC<{
  label: string;
  description: string;
  value: string | null;
  agents: Array<{ name: string }>;
  onChange: (agentName: string | null) => void;
}> = ({ label, description, value, agents, onChange }) => (
  <label className="block space-y-1">
    <span className="typography-meta text-muted-foreground">{label}</span>
    <Select
      value={value ?? '__default'}
      onValueChange={(nextValue) => onChange(nextValue === '__default' ? null : nextValue)}
    >
      <SelectTrigger className="h-8 w-full sm:w-64">
        <SelectValue>{value ?? 'Default active agent'}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__default">Default active agent</SelectItem>
        {agents.map((agent) => (
          <SelectItem key={agent.name} value={agent.name}>{agent.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="typography-meta text-muted-foreground">{description}</p>
  </label>
);

type DevChamberFeatureSettingsSection = 'autocomplete' | 'agents' | 'workspace' | 'commit' | 'autoApprove';

type DevChamberFeatureSettingsProps = {
  sections?: DevChamberFeatureSettingsSection[];
};

export const FallbackModelPicker: React.FC<{
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
  const visibleSections = React.useMemo(() => new Set<DevChamberFeatureSettingsSection>(sections ?? ['autocomplete', 'agents', 'workspace', 'commit', 'autoApprove']), [sections]);
  const settingsForkFeatures = useConfigStore((state) => state.settingsForkFeatures);
  const setSettingsForkFeatures = useConfigStore((state) => state.setSettingsForkFeatures);
  const agentList = useConfigStore((state) => state.agents);
  const agents = React.useMemo(() => filterVisibleAgents(agentList), [agentList]);
  const [allowedToolsDraft, setAllowedToolsDraft] = React.useState(() => formatCsv(settingsForkFeatures.autoApprove.allowedTools));

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
      {visibleSections.has('autocomplete') && (
      <section className="min-w-0 space-y-3 overflow-hidden rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3">
        <div className="space-y-1">
          <h4 className="typography-ui-label font-medium text-foreground">Code autocomplete</h4>
          <p className="typography-meta text-muted-foreground">Control DevChamber inline suggestions in the VS Code editor.</p>
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

        <AgentSelectRow
          label="Autocomplete agent"
          description="Used by the VS Code inline autocomplete provider when set."
          value={settingsForkFeatures.autocomplete.agentName}
          agents={agents}
          onChange={(agentName) => updateFeatures((current) => ({
            ...current,
            autocomplete: {
              ...current.autocomplete,
              agentName,
            },
          }))}
        />

        <ToggleRow
          checked={settingsForkFeatures.autocomplete.multilineEnabled}
          label="Multiline code completion"
          description="Allow inline suggestions to include short repeated code blocks, not just same-line suffixes."
          onChange={(checked) => updateFeatures((current) => ({
            ...current,
            autocomplete: { ...current.autocomplete, multilineEnabled: checked },
          }))}
        />

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1">
            <span className="typography-meta text-muted-foreground">Throttle timeout, ms</span>
            <Input
              type="number"
              min={0}
              max={2000}
              value={settingsForkFeatures.autocomplete.throttleMs}
              onChange={(event) => {
                const value = Number(event.target.value);
                updateFeatures((current) => ({
                  ...current,
                  autocomplete: { ...current.autocomplete, throttleMs: Number.isFinite(value) ? value : current.autocomplete.throttleMs },
                }));
              }}
              className="h-8 w-full"
            />
          </label>
          <label className="block space-y-1">
            <span className="typography-meta text-muted-foreground">Max characters</span>
            <Input
              type="number"
              min={20}
              max={2000}
              value={settingsForkFeatures.autocomplete.maxSuggestionLength}
              onChange={(event) => {
                const value = Number(event.target.value);
                updateFeatures((current) => ({
                  ...current,
                  autocomplete: { ...current.autocomplete, maxSuggestionLength: Number.isFinite(value) ? value : current.autocomplete.maxSuggestionLength },
                }));
              }}
              className="h-8 w-full"
            />
          </label>
          <label className="block space-y-1">
            <span className="typography-meta text-muted-foreground">Max lines</span>
            <Input
              type="number"
              min={1}
              max={20}
              value={settingsForkFeatures.autocomplete.maxSuggestionLines}
              onChange={(event) => {
                const value = Number(event.target.value);
                updateFeatures((current) => ({
                  ...current,
                  autocomplete: { ...current.autocomplete, maxSuggestionLines: Number.isFinite(value) ? value : current.autocomplete.maxSuggestionLines },
                }));
              }}
              className="h-8 w-full"
            />
          </label>
          <label className="block space-y-1">
            <span className="typography-meta text-muted-foreground">Min prefix characters</span>
            <Input
              type="number"
              min={1}
              max={12}
              value={settingsForkFeatures.autocomplete.minPrefixLength}
              onChange={(event) => {
                const value = Number(event.target.value);
                updateFeatures((current) => ({
                  ...current,
                  autocomplete: { ...current.autocomplete, minPrefixLength: Number.isFinite(value) ? value : current.autocomplete.minPrefixLength },
                }));
              }}
              className="h-8 w-full"
            />
          </label>
        </div>
        <p className="typography-meta text-muted-foreground">
          Keep throttle above zero to avoid noisy provider calls while typing; increase max lines only if multiline suggestions feel too short.
        </p>
      </section>
      )}

      {visibleSections.has('agents') && (
      <section className="min-w-0 space-y-3 overflow-hidden rounded-lg border border-border/40 bg-[var(--surface-elevated)] p-3">
        <div className="space-y-1">
          <h4 className="typography-ui-label font-medium text-foreground">Feature agents</h4>
          <p className="typography-meta text-muted-foreground">Choose which configured agent each DevChamber feature should use.</p>
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <AgentSelectRow
            label="Autocomplete agent"
            description="Agent used by the VS Code inline autocomplete provider."
            value={settingsForkFeatures.autocomplete.agentName}
            agents={agents}
            onChange={(agentName) => updateFeatures((current) => ({
              ...current,
              autocomplete: { ...current.autocomplete, agentName },
            }))}
          />
          <AgentSelectRow
            label="Commit generation agent"
            description="Agent used for generated commit messages and variants."
            value={settingsForkFeatures.commitGeneration.agentName}
            agents={agents}
            onChange={(agentName) => updateFeatures((current) => ({
              ...current,
              commitGeneration: { ...current.commitGeneration, agentName },
            }))}
          />
          <AgentSelectRow
            label="PR summary agent"
            description="Agent used for pull request summaries."
            value={settingsForkFeatures.prSummaries.agentName}
            agents={agents}
            onChange={(agentName) => updateFeatures((current) => ({
              ...current,
              prSummaries: { ...current.prSummaries, agentName },
            }))}
          />
          <AgentSelectRow
            label="Docs/change-notes agent"
            description="Agent used for documentation checks and change-note writing."
            value={settingsForkFeatures.docs.agentName}
            agents={agents}
            onChange={(agentName) => updateFeatures((current) => ({
              ...current,
              docs: { ...current.docs, agentName },
            }))}
          />
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
