import type { Provider } from '@opencode-ai/sdk/v2';

export type GenerationModelSelection = {
  providerId: string;
  modelId: string;
};

export type GenerationModelOption = {
  value: string;
  label: string;
  providerId: string;
  modelId: string;
};

type ProviderModel = Provider['models'][string];
export type ProviderWithModels = Omit<Provider, 'models'> & { models: ProviderModel[] };

export const GENERATION_MODEL_AUTO_VALUE = '__auto__';

export const encodeGenerationModelValue = (selection: GenerationModelSelection): string => (
  `${encodeURIComponent(selection.providerId)}::${encodeURIComponent(selection.modelId)}`
);

export const decodeGenerationModelValue = (value: string): GenerationModelSelection | null => {
  if (!value || value === GENERATION_MODEL_AUTO_VALUE) {
    return null;
  }
  const [providerId, modelId] = value.split('::').map((part) => decodeURIComponent(part ?? '').trim());
  return providerId && modelId ? { providerId, modelId } : null;
};

export const buildGenerationModelOptions = (providers: ProviderWithModels[]): GenerationModelOption[] => (
  providers.flatMap((provider) => (
    (provider.models ?? []).map((model) => {
      const selection = { providerId: provider.id, modelId: model.id };
      return {
        ...selection,
        value: encodeGenerationModelValue(selection),
        label: `${provider.name ?? provider.id} · ${model.name ?? model.id}`,
      };
    })
  ))
);
