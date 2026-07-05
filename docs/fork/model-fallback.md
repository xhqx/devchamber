# Model fallback

Model fallback retries safe, idempotent AI generation tasks on configured backup models.

## Safe purposes

- commit message generation
- PR description generation
- docs/change explanation generation
- autocomplete suggestions
- chat only when the caller marks the operation as safe to retry

Never use fallback to retry tool execution or commands with side effects.

## Chain shape

```ts
{
  purpose: 'commit',
  models: [{ providerID: 'opencode', modelID: 'big-pickle' }],
  maxAttempts: 2,
  retryOn: ['timeout', 'rate_limit', 'server_error', 'invalid_json']
}
```

The wrapper records each failed attempt and returns the selected model metadata with the successful result.
