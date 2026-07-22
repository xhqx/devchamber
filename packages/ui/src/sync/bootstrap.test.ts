import { describe, expect, test } from 'bun:test'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { bootstrapGlobal } from './bootstrap'
import type { GlobalState } from './types'

const originalFetch = globalThis.fetch
const originalConsoleError = console.error

const failingResult = (message: string) => ({
  error: { message },
  response: { status: 400 },
})

const createGlobalBootstrapSdk = (result: unknown): OpencodeClient => ({
  path: {
    get: async () => result,
  },
  global: {
    config: {
      get: async () => result,
    },
  },
  project: {
    list: async () => result,
  },
}) as unknown as OpencodeClient

describe('bootstrapGlobal', () => {
  test('surfaces OpenCode startup failures from health instead of leaving the UI not ready', async () => {
    const patches: Partial<GlobalState>[] = []
    const sdk = createGlobalBootstrapSdk(failingResult('Agent frontmatter is invalid'))

    try {
      console.error = () => undefined
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        expect(String(input)).toBe('/health')
        return new Response(JSON.stringify({
          status: 'ok',
          openCodeRunning: false,
          lastOpenCodeError: 'Failed to load agent: invalid frontmatter in agent.md',
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }) as typeof fetch

      await bootstrapGlobal(sdk, (patch) => patches.push(patch))

      expect(patches.at(-1)).toEqual({
        ready: true,
        error: {
          type: 'init',
          message: 'Failed to load agent: invalid frontmatter in agent.md',
        },
      })
    } finally {
      console.error = originalConsoleError
      globalThis.fetch = originalFetch
    }
  })

  test('falls back to a clear not-running message when health has no detailed OpenCode error', async () => {
    const patches: Partial<GlobalState>[] = []
    const sdk = createGlobalBootstrapSdk(failingResult('Agent frontmatter is invalid'))

    try {
      console.error = () => undefined
      globalThis.fetch = (async () => new Response(JSON.stringify({
        status: 'ok',
        openCodeRunning: false,
        lastOpenCodeError: null,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch

      await bootstrapGlobal(sdk, (patch) => patches.push(patch))

      expect(patches.at(-1)).toEqual({
        ready: true,
        error: {
          type: 'init',
          message: 'OpenCode process is not running',
        },
      })
    } finally {
      console.error = originalConsoleError
      globalThis.fetch = originalFetch
    }
  })
})
