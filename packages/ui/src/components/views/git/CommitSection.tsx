import { Button } from '@/components/ui/button';
import { CommitInput } from './CommitInput';
import { AIHighlightsBox } from './AIHighlightsBox';
import { useDeviceInfo } from '@/lib/device';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from "@/components/icon/Icon";
import { useI18n } from '@/lib/i18n';
import type { CommitSuggestion } from '@/lib/autocomplete/commitScopes';
import type { CommitGenerationVariant } from '@/lib/commitGeneration';
import { GenerationModelPicker } from './GenerationModelPicker';
import type { GenerationModelSelection, ProviderWithModels } from '@/lib/generationModelSelection';
import { DocsRequiredBanner } from '@/components/changeExplanations/DocsRequiredBanner';
import type { DocsCommitStatus } from '@/lib/changeExplanations/docsStatus';

type CommitAction = 'commit' | 'commitAndPush' | null;

interface CommitSectionProps {
  stagedCount: number;
  commitMessage: string;
  onCommitMessageChange: (value: string) => void;
  generatedHighlights: string[];
  onInsertHighlights: (highlights: string[]) => void;
  onGenerateMessage: () => void;
  isGeneratingMessage: boolean;
  onCommit: () => void;
  onCommitAndPush: () => void;
  commitAction: CommitAction;
  hasPendingIndexMutation?: boolean;
  gitmojiEnabled: boolean;
  onOpenGitmojiPicker: () => void;
  commitSuggestions?: CommitSuggestion[];
  autocompleteEnabled?: boolean;
  commitGenerationVariants?: CommitGenerationVariant[];
  onSelectCommitGenerationVariant?: (variant: CommitGenerationVariant) => void;
  commitGenerationBudgetLabel?: string | null;
  generationModelProviders?: ProviderWithModels[];
  generationModelSelection?: GenerationModelSelection | null;
  resolvedGenerationModel?: GenerationModelSelection | null;
  onGenerationModelSelectionChange?: (selection: GenerationModelSelection | null) => void;
  docsCommitStatus?: DocsCommitStatus | null;
  docsNotNeededReason?: string;
  onDocsNotNeededReasonChange?: (reason: string) => void;
}

export const CommitSection: React.FC<CommitSectionProps> = ({
  stagedCount,
  commitMessage,
  onCommitMessageChange,
  generatedHighlights,
  onInsertHighlights,
  onGenerateMessage,
  isGeneratingMessage,
  onCommit,
  onCommitAndPush,
  commitAction,
  hasPendingIndexMutation = false,
  gitmojiEnabled,
  onOpenGitmojiPicker,
  commitSuggestions = [],
  autocompleteEnabled = false,
  commitGenerationVariants = [],
  onSelectCommitGenerationVariant,
  commitGenerationBudgetLabel = null,
  generationModelProviders = [],
  generationModelSelection = null,
  resolvedGenerationModel = null,
  onGenerationModelSelectionChange,
  docsCommitStatus = null,
  docsNotNeededReason = '',
  onDocsNotNeededReasonChange,
}) => {
  const { t } = useI18n();
  const hasStagedFiles = stagedCount > 0;
  const isDocsBlocked = Boolean(docsCommitStatus?.isBlocked);
  const canCommit = commitMessage.trim() && hasStagedFiles && commitAction === null && !hasPendingIndexMutation && !isDocsBlocked;
  const { isMobile, hasTouchInput } = useDeviceInfo();

  const containerClassName = 'border-0 bg-transparent rounded-none';
  const headerClassName = 'flex w-full items-baseline gap-2 px-0 pt-2 pb-1';
  const contentClassName = 'flex flex-col gap-3 px-0 pt-1 pb-3';

  return (
    <section className={containerClassName}>
      <div className={headerClassName}>
        <h3 className="typography-ui-header font-semibold text-foreground">{t('gitView.commit.title')}</h3>
        {!hasStagedFiles ? (
          <span className="min-w-0 truncate typography-meta text-muted-foreground">
            {t('gitView.commit.stageFilesHint')}
          </span>
        ) : null}
      </div>

      <div className={contentClassName}>
        <AIHighlightsBox
          highlights={generatedHighlights}
          onInsert={onInsertHighlights}
        />

        {onGenerationModelSelectionChange ? (
          <GenerationModelPicker
            providers={generationModelProviders}
            value={generationModelSelection}
            resolvedValue={resolvedGenerationModel}
            onChange={onGenerationModelSelectionChange}
            disabled={commitAction !== null || isGeneratingMessage}
          />
        ) : null}

        <CommitInput
          value={commitMessage}
          onChange={onCommitMessageChange}
          placeholder={t('gitView.commit.messagePlaceholder')}
          disabled={commitAction !== null}
          hasTouchInput={hasTouchInput}
          isMobile={isMobile}
          suggestions={commitSuggestions}
          autocompleteEnabled={autocompleteEnabled}
        />

        {gitmojiEnabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenGitmojiPicker}
            className="w-fit"
            type="button"
          >
            <Icon name="emotion-happy" className="size-4" />
            {t('gitView.commit.addGitmoji')}
          </Button>
        )}

        {commitGenerationBudgetLabel ? (
          <div className="typography-meta text-muted-foreground">
            {commitGenerationBudgetLabel}
          </div>
        ) : null}

        {docsCommitStatus && onDocsNotNeededReasonChange ? (
          <DocsRequiredBanner
            status={docsCommitStatus}
            notNeededReason={docsNotNeededReason}
            onNotNeededReasonChange={onDocsNotNeededReasonChange}
          />
        ) : null}

        {commitGenerationVariants.length > 0 && onSelectCommitGenerationVariant ? (
          <div className="rounded-md border border-border bg-muted/30 p-2">
            <div className="mb-2 typography-meta font-medium text-muted-foreground">
              Generated variants
            </div>
            <div className="flex flex-wrap gap-2">
              {commitGenerationVariants.map((variant) => (
                <Button
                  key={variant.id}
                  variant={variant.subject === commitMessage.trim() ? 'default' : 'outline'}
                  size="sm"
                  type="button"
                  onClick={() => onSelectCommitGenerationVariant(variant)}
                  title={variant.detail}
                >
                  {variant.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="@container/commit-actions flex items-center gap-2 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerateMessage}
            disabled={
              isGeneratingMessage ||
              commitAction !== null ||
              hasPendingIndexMutation ||
              stagedCount === 0
            }
            type="button"
            aria-label={t('gitView.commit.generateAria')}
            className="commit-actions__btn"
          >
            {isGeneratingMessage ? (
              <Icon name="loader-4" className="size-4 animate-spin" />
            ) : (
              <Icon name="ai-generate-2" className="size-4 text-primary" />
            )}
            <span className="commit-actions__label">{t('gitView.commit.generate')}</span>
          </Button>

          <div className="flex-1" />

          <Button
            size="sm"
            variant="outline"
            onClick={onCommit}
            disabled={!canCommit || isGeneratingMessage}
            className="commit-actions__btn whitespace-nowrap"
            aria-label={t('gitView.commit.commitAria')}
          >
            {commitAction === 'commit' ? (
              <>
                <Icon name="loader-4" className="size-4 animate-spin" />
                <span className="commit-actions__label">{t('gitView.commit.committing')}</span>
              </>
            ) : (
              <>
                <Icon name="git-commit" className="size-4" />
                <span className="commit-actions__label">{t('gitView.commit.commit')}</span>
              </>
            )}
          </Button>

          {isMobile ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onCommitAndPush()}
                  disabled={!canCommit || isGeneratingMessage}
                  className="h-7 w-7 p-0"
                  aria-label={t('gitView.commit.pushAria')}
                >
                  {commitAction === 'commitAndPush' ? (
                    <Icon name="loader-4" className="size-4 animate-spin" />
                  ) : (
                    <Icon name="arrow-up" className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{t('gitView.commit.push')}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={() => onCommitAndPush()}
              disabled={!canCommit || isGeneratingMessage}
              className="commit-actions__btn"
              aria-label={t('gitView.commit.pushAria')}
            >
              {commitAction === 'commitAndPush' ? (
                <>
                  <Icon name="loader-4" className="size-4 animate-spin" />
                  <span className="commit-actions__label commit-actions__label--push">{t('gitView.commit.pushing')}</span>
                </>
              ) : (
                <>
                  <Icon name="arrow-up" className="size-3.5" />
                  <span className="commit-actions__label commit-actions__label--push">{t('gitView.commit.push')}</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
