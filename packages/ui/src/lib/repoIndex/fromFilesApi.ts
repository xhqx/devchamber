import type { FilesAPI } from '../api/types';
import { buildRepoIndex } from './indexer';
import type { RepoIndex, RepoIndexInputFile } from './schema';

export interface FilesApiRepoIndexOptions {
  directory?: string;
  maxFiles?: number;
  maxFileSize?: number;
}

export const buildRepositoryIndexFromFilesApi = async (
  files: Pick<FilesAPI, 'scanRepoIndex'>,
  options: FilesApiRepoIndexOptions = {},
): Promise<RepoIndex> => {
  if (!files.scanRepoIndex) {
    throw new Error('Repository index scanning is not available in this runtime');
  }

  const scan = await files.scanRepoIndex({
    directory: options.directory,
    maxFiles: options.maxFiles,
    maxFileSize: options.maxFileSize,
    includeContent: true,
    respectGitignore: true,
  });

  const inputFiles: RepoIndexInputFile[] = scan.files.map((file) => ({
    path: file.relativePath || file.path,
    content: file.content,
    size: file.size,
    mtimeMs: file.mtimeMs,
  }));

  return buildRepoIndex(inputFiles);
};
