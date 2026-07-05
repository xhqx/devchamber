import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Icon } from '@/components/icon/Icon';
import {
  buildGenerationModelOptions,
  decodeGenerationModelValue,
  encodeGenerationModelValue,
  GENERATION_MODEL_AUTO_VALUE,
  type GenerationModelSelection,
  type ProviderWithModels,
} from '@/lib/generationModelSelection';

interface GenerationModelPickerProps {
  providers: ProviderWithModels[];
  value: GenerationModelSelection | null;
  resolvedValue?: GenerationModelSelection | null;
  onChange: (selection: GenerationModelSelection | null) => void;
  disabled?: boolean;
}

export const GenerationModelPicker: React.FC<GenerationModelPickerProps> = ({
  providers,
  value,
  resolvedValue = null,
  onChange,
  disabled = false,
}) => {
  const options = React.useMemo(() => buildGenerationModelOptions(providers), [providers]);
  const currentValue = value ? encodeGenerationModelValue(value) : GENERATION_MODEL_AUTO_VALUE;
  const resolvedLabel = React.useMemo(() => {
    if (!resolvedValue) return 'active session';
    const resolvedOption = options.find((option) => (
      option.providerId === resolvedValue.providerId && option.modelId === resolvedValue.modelId
    ));
    return resolvedOption?.label ?? `${resolvedValue.providerId} · ${resolvedValue.modelId}`;
  }, [options, resolvedValue]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
      <div className="flex items-center gap-1.5 typography-meta text-muted-foreground">
        <Icon name="ai-generate-2" className="size-3.5" />
        Commit model
      </div>
      <Select
        value={currentValue}
        onValueChange={(nextValue) => onChange(decodeGenerationModelValue(nextValue))}
        disabled={disabled || options.length === 0}
      >
        <SelectTrigger size="sm" className="max-w-[15rem]">
          <SelectValue>
            {(selected) => {
              if (!selected || selected === GENERATION_MODEL_AUTO_VALUE) {
                return `Auto (${resolvedLabel})`;
              }
              return options.find((option) => option.value === selected)?.label ?? selected;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent fitContent sideOffset={4}>
          <SelectItem value={GENERATION_MODEL_AUTO_VALUE}>Auto ({resolvedLabel})</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
