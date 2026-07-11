import * as vscode from 'vscode';
import { buildCodeAutocompleteSuggestion } from './codeAutocompleteCore';

const CONFIG_SECTION = 'devchamber';
const CONFIG_KEY = 'fork.autocomplete.enabled';
const AGENT_CONFIG_KEY = 'fork.autocomplete.agentName';
const MAX_DOCUMENT_CHARS = 200_000;

const isCodeAutocompleteEnabled = (): boolean => (
  vscode.workspace.getConfiguration(CONFIG_SECTION).get<boolean>(CONFIG_KEY, true)
);

const getCodeAutocompleteAgentName = (): string | null => {
  const value = vscode.workspace.getConfiguration(CONFIG_SECTION).get<string>(AGENT_CONFIG_KEY, '');
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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
  provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.InlineCompletionList> {
    if (token.isCancellationRequested || !isCodeAutocompleteEnabled()) {
      return new vscode.InlineCompletionList([]);
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor?.document !== document) {
      return new vscode.InlineCompletionList([]);
    }

    const line = document.lineAt(position.line).text;
    const linePrefix = line.slice(0, position.character);
    const lineSuffix = line.slice(position.character);
    const { text, offset } = getBoundedDocumentText(document, position);
    const autocompleteAgentName = getCodeAutocompleteAgentName();
    const suggestion = buildCodeAutocompleteSuggestion({
      text,
      offset,
      linePrefix,
      lineSuffix,
      languageId: document.languageId,
      agentName: autocompleteAgentName ?? undefined,
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
