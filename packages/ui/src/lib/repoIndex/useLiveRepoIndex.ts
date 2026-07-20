import React from 'react';

import type { FilesAPI } from '@/lib/api/types';
import { buildRepositoryIndexFromFilesApi } from '@/lib/repoIndex/fromFilesApi';
import type { RepoIndex } from '@/lib/repoIndex/schema';

export type LiveRepoIndexState = {
  index: RepoIndex | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

type RepoIndexChangePayload = {
  directory?: string | null;
  paths?: string[];
  reason?: string;
};

type UseLiveRepoIndexOptions = {
  files: FilesAPI;
  directory: string;
  maxFiles: number;
  emptyDirectoryError: string;
  unavailableError: string;
  failureError: string;
};

const normalizePath = (value: string | null | undefined): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return '';
  const normalized = trimmed.replace(/\\/g, '/');
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
};

const isInsideDirectory = (path: string, directory: string): boolean => {
  if (!path || !directory) return false;
  if (path === directory) return true;
  return path.startsWith(`${directory}/`);
};

const shouldRefreshForPayload = (payload: RepoIndexChangePayload | undefined, directory: string): boolean => {
  if (!directory) return false;
  const payloadDirectory = normalizePath(payload?.directory);
  if (payloadDirectory && payloadDirectory !== directory && !isInsideDirectory(payloadDirectory, directory)) {
    return false;
  }
  const paths = Array.isArray(payload?.paths) ? payload.paths.map(normalizePath).filter(Boolean) : [];
  if (paths.length === 0) return true;
  return paths.some((path) => isInsideDirectory(path, directory));
};

const getRepoIndexChangePayload = (event: Event): RepoIndexChangePayload | undefined => {
  const detail = (event as CustomEvent<RepoIndexChangePayload>).detail;
  return detail && typeof detail === 'object' ? detail : undefined;
};

const getRepoIndexChangePayloadFromMessage = (event: MessageEvent): RepoIndexChangePayload | null => {
  const data = event.data as { type?: unknown; command?: unknown; payload?: unknown } | undefined;
  if (!data || data.type !== 'command' || data.command !== 'projectFilesChanged') {
    return null;
  }
  return data.payload && typeof data.payload === 'object'
    ? data.payload as RepoIndexChangePayload
    : {};
};

export const useLiveRepoIndex = ({
  files,
  directory,
  maxFiles,
  emptyDirectoryError,
  unavailableError,
  failureError,
}: UseLiveRepoIndexOptions): LiveRepoIndexState => {
  const projectRoot = normalizePath(directory);
  const [index, setIndex] = React.useState<RepoIndex | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const refreshTimerRef = React.useRef<number | null>(null);
  const refreshGenerationRef = React.useRef(0);

  const clearRefreshTimer = React.useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const refresh = React.useCallback(async () => {
    const generation = refreshGenerationRef.current + 1;
    refreshGenerationRef.current = generation;
    clearRefreshTimer();

    if (!projectRoot) {
      setIndex(null);
      setError(emptyDirectoryError);
      setIsLoading(false);
      return;
    }
    if (!files.scanRepoIndex) {
      setIndex(null);
      setError(unavailableError);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextIndex = await buildRepositoryIndexFromFilesApi(files, { directory: projectRoot, maxFiles });
      if (refreshGenerationRef.current === generation) {
        setIndex(nextIndex);
      }
    } catch (refreshError) {
      if (refreshGenerationRef.current === generation) {
        setIndex(null);
        setError(refreshError instanceof Error ? refreshError.message : failureError);
      }
    } finally {
      if (refreshGenerationRef.current === generation) {
        setIsLoading(false);
      }
    }
  }, [clearRefreshTimer, emptyDirectoryError, failureError, files, maxFiles, projectRoot, unavailableError]);

  const scheduleRefresh = React.useCallback((payload?: RepoIndexChangePayload, delayMs = 900) => {
    if (!shouldRefreshForPayload(payload, projectRoot)) return;
    clearRefreshTimer();
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, delayMs);
  }, [clearRefreshTimer, projectRoot, refresh]);

  React.useEffect(() => {
    void refresh();
    return () => clearRefreshTimer();
  }, [clearRefreshTimer, refresh]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRepoIndexInvalidated = (event: Event) => {
      scheduleRefresh(getRepoIndexChangePayload(event));
    };
    const handleMessage = (event: MessageEvent) => {
      const payload = getRepoIndexChangePayloadFromMessage(event);
      if (payload !== null) {
        scheduleRefresh(payload);
      }
    };
    const handleFocus = () => {
      scheduleRefresh({ directory: projectRoot }, 1200);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleRefresh({ directory: projectRoot }, 1200);
      }
    };

    window.addEventListener('openchamber:repo-index-invalidated', handleRepoIndexInvalidated as EventListener);
    window.addEventListener('message', handleMessage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('openchamber:repo-index-invalidated', handleRepoIndexInvalidated as EventListener);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [projectRoot, scheduleRefresh]);

  return { index, isLoading, error, refresh };
};
