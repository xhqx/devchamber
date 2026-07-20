import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCodeAutocompleteSuggestion } from './codeAutocompleteCore';

const request = (text: string, marker = '▮', languageId = 'typescript') => {
  const offset = text.indexOf(marker);
  assert.notEqual(offset, -1, 'marker must exist');
  const withoutMarker = text.replace(marker, '');
  const lineStart = withoutMarker.lastIndexOf('\n', offset - 1) + 1;
  const lineEnd = withoutMarker.indexOf('\n', offset);
  const line = withoutMarker.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const character = offset - lineStart;
  return {
    text: withoutMarker,
    offset,
    linePrefix: line.slice(0, character),
    lineSuffix: line.slice(character),
    languageId,
  };
};

describe('code autocomplete core', () => {
  test('suggests the suffix for an identifier already present in the file', () => {
    const suggestion = buildCodeAutocompleteSuggestion(request(`
const selectedProviderId = 'openai';
const selected▮
`));
    assert.deepEqual(suggestion, { insertText: 'ProviderId', kind: 'identifier' });
  });

  test('uses member names from prior code after a dot', () => {
    const suggestion = buildCodeAutocompleteSuggestion(request(`
config.modelFallback.enabled = true;
settings.modelFallback.chain = [];
config.▮
`));
    assert.deepEqual(suggestion, { insertText: 'modelFallback', kind: 'member' });
  });

  test('does not suggest inside unsupported prose files', () => {
    const suggestion = buildCodeAutocompleteSuggestion(request(`
A paragraph with selectedProviderId.
selected▮
`, '▮', 'markdown'));
    assert.equal(suggestion, null);
  });

  test('does not overwrite non-closing text after the cursor', () => {
    const suggestion = buildCodeAutocompleteSuggestion(request(`
const selectedProviderId = 'openai';
const selected▮Other
`));
    assert.equal(suggestion, null);
  });

  test('can repeat a prior line suffix for structured code', () => {
    const suggestion = buildCodeAutocompleteSuggestion(request(`
  timeoutSeconds: 30,
  timeout▮
`));
    assert.deepEqual(suggestion, { insertText: 'Seconds', kind: 'identifier' });
  });

  test('suggests multiline repeated code blocks', () => {
    const suggestion = buildCodeAutocompleteSuggestion({
      ...request(`
if (user.isAdmin) {
  grantAccess(user);
  return true;
}

if (user.isOwner) {▮
`),
      maxSuggestionLines: 4,
    });
    assert.deepEqual(suggestion, {
      insertText: '\n  grantAccess(user);\n  return true;\n}',
      kind: 'multiline',
    });
  });

  test('honors multiline completion opt-out', () => {
    const suggestion = buildCodeAutocompleteSuggestion({
      ...request(`
if (user.isAdmin) {
  grantAccess(user);
}

if (user.isOwner) {▮
`),
      multilineEnabled: false,
    });
    assert.equal(suggestion, null);
  });

  test('honors custom minimum prefix length for identifier completions', () => {
    const suggestion = buildCodeAutocompleteSuggestion({
      ...request(`
const selectedProviderId = 'openai';
const selected▮
`),
      minPrefixLength: 10,
    });
    assert.equal(suggestion, null);
  });
});
