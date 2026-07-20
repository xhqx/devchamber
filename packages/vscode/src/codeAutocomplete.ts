import * as vscode from 'vscode';
import { readSettings } from './bridge-settings-runtime';
import { buildCodeAutocompleteSuggestion } from './codeAutocompleteCore';

const MAX_DOCUMENT_CHARS = 200_000;

type CodeAutocompleteSettings = {
  enabled: boolean;
  agentName: string | null;
  multilineEnabled: boolean;
  throttleMs: number;
  maxSuggestionLength: number;
  maxSuggestionLines: number;
  minPrefixLength: number;
};

const readCodeAutocompleteSettings = (): CodeAutocompleteSettings => {
  const settings = readSettings();
  const forkFeatures = settings.forkFeatures && typeof settings.forkFeatures === 'object'
    ? settings.forkFeatures as Record<string, unknown>
    : {};
  const autocomplete = forkFeatures.autocomplete && typeof forkFeatures.autocomplete === 'object'
    ? forkFeatures.autocomplete as Record<string, unknown>
    : {};
  const rawAgentName = typeof autocomplete.agentName === 'string' ? autocomplete.agentName.trim() : '';
  const positiveInteger = (value: unknown, fallback: number, min: number, max: number): number => {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    return Math.max(min, Math.min(max, Math.floor(numeric)));
  };
  return {
    enabled: typeof autocomplete.enabled === 'boolean' ? autocomplete.enabled : true,
    agentName: rawAgentName.length > 0 ? rawAgentName : null,
    multilineEnabled: typeof autocomplete.multilineEnabled === 'boolean' ? autocomplete.multilineEnabled : true,
    throttleMs: positiveInteger(autocomplete.throttleMs, 120, 0, 2_000),
    maxSuggestionLength: positiveInteger(autocomplete.maxSuggestionLength, 500, 20, 2_000),
    maxSuggestionLines: positiveInteger(autocomplete.maxSuggestionLines, 6, 1, 20),
    minPrefixLength: positiveInteger(autocomplete.minPrefixLength, 2, 1, 12),
  };
};

const getBoundedDocumentText = (document: vscode.TextDocument, position: vscode.Position): { text: string; offset: number } => {
  const fullText = document.getText();
  const fullOffset = document.offsetAt(position);
  if (fullText.length <= MAX_DOCUMENT_CHARS) {
    return { text: fullText, offset: fullOffset };
  }

  const start = Math.max(0, fullOffset - Math.floor(MAX_DOCUMENT_CHARS * 0.75));
  const end = Math.min(fullText.length, start + MAX_DOCUMENT_CHARS);
  return {
    text: fullText.slice(start, end),
    offset: fullOffset - start,
  };
};

class DevChamberInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  private lastSuggestionAt = 0;

  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.InlineCompletionList> {
    const autocompleteSettings = readCodeAutocompleteSettings();
    if (token.isCancellationRequested || !autocompleteSettings.enabled) {
      return new vscode.InlineCompletionList([]);
    }

    const now = Date.now();
    if (autocompleteSettings.throttleMs > 0 && now - this.lastSuggestionAt < autocompleteSettings.throttleMs) {
      return new vscode.InlineCompletionList([]);
    }
    this.lastSuggestionAt = now;

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor?.document !== document) {
      return new vscode.InlineCompletionList([]);
    }

    const line = document.lineAt(position.line).text;
    const linePrefix = line.slice(0, position.character);
    const lineSuffix = line.slice(position.character);
    const { text, offset } = getBoundedDocumentText(document, position);
    const autocompleteAgentName = autocompleteSettings.agentName;
    const suggestion = buildCodeAutocompleteSuggestion({
      text,
      offset,
      linePrefix,
      lineSuffix,
      languageId: document.languageId,
      agentName: autocompleteAgentName ?? undefined,
      maxSuggestionLength: autocompleteSettings.maxSuggestionLength,
      multilineEnabled: autocompleteSettings.multilineEnabled,
      maxSuggestionLines: autocompleteSettings.maxSuggestionLines,
      minPrefixLength: autocompleteSettings.minPrefixLength,
    });

    if (!suggestion) {
      return new vscode.InlineCompletionList([]);
    }

    const item = new vscode.InlineCompletionItem(
      suggestion.insertText,
      new vscode.Range(position, position),
    );
    return new vscode.InlineCompletionList([item]);
  }
}

export const registerCodeAutocompleteProvider = (context: vscode.ExtensionContext): vscode.Disposable => {
  const provider = new DevChamberInlineCompletionProvider();
  const disposable = vscode.languages.registerInlineCompletionItemProvider(
    [
      { scheme: 'file' },
      { scheme: 'untitled' },
    ],
    provider,
  );
  context.subscriptions.push(disposable);
  return disposable;
};
