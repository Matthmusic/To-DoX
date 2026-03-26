import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFilePaths, resolveDroppedLinkFromDataTransfer } from './taskLinks';

function makeFileList(files: File[]): FileList {
  const fileList = {
    item: (index: number) => files[index] ?? null,
  } as FileList;

  Object.defineProperty(fileList, 'length', { value: files.length });
  files.forEach((file, index) => {
    Object.defineProperty(fileList, index, { value: file, enumerable: true });
  });

  return fileList;
}

function makeDataTransfer(options?: {
  files?: File[];
  data?: Record<string, string>;
  types?: string[];
}): DataTransfer {
  const files = options?.files ?? [];
  const data = options?.data ?? {};

  return {
    files: makeFileList(files),
    getData: (type: string) => data[type] ?? '',
    types: options?.types ?? [...(files.length > 0 ? ['Files'] : []), ...Object.keys(data)],
  } as unknown as DataTransfer;
}

describe('taskLinks', () => {
  beforeEach(() => {
    window.electronAPI = {
      getPathForFile: vi.fn(() => ''),
      outlook: {
        saveDroppedMail: vi.fn(),
      },
    } as never;
  });

  it('classifies Outlook URLs and .msg paths as outlook links', () => {
    const parts = parseFilePaths(
      'Spec https://outlook.office.com/mail/inbox/id and "C:\\Mail Store\\spec.msg"',
    );

    expect(parts).toEqual([
      { type: 'text', content: 'Spec ' },
      { type: 'outlook', content: 'https://outlook.office.com/mail/inbox/id', targetType: 'url' },
      { type: 'text', content: ' and ' },
      { type: 'outlook', content: 'C:\\Mail Store\\spec.msg', targetType: 'path' },
    ]);
  });

  it('prefers a native dropped path over URL payloads', async () => {
    const file = new File(['msg'], 'native.msg', { type: 'application/vnd.ms-outlook' });
    window.electronAPI!.getPathForFile = vi.fn(() => 'C:\\Mail Store\\native.msg');

    const result = await resolveDroppedLinkFromDataTransfer(
      makeDataTransfer({
        files: [file],
        data: { 'text/plain': 'https://outlook.office.com/mail/inbox/id' },
      }),
      { storagePath: 'C:\\Storage' },
    );

    expect(result).toEqual({
      insertedText: '"C:\\Mail Store\\native.msg"',
      type: 'outlook',
      target: 'C:\\Mail Store\\native.msg',
      targetType: 'path',
    });
  });

  it('does not inject the Outlook fallback label for a generic URL drop', async () => {
    const result = await resolveDroppedLinkFromDataTransfer(
      makeDataTransfer({
        data: { 'text/plain': 'https://example.com/spec' },
      }),
      { storagePath: 'C:\\Storage' },
    );

    expect(result).toEqual({
      insertedText: 'https://example.com/spec',
      type: 'url',
      target: 'https://example.com/spec',
      targetType: 'url',
    });
  });

  it('saves a virtual Outlook .msg file when no native path is available', async () => {
    const file = new File(['msg-body'], 'Spec review.msg', { type: 'application/vnd.ms-outlook' });
    window.electronAPI!.outlook.saveDroppedMail = vi.fn(async () => ({
      success: true,
      path: 'C:\\Mail Store\\Spec review.msg',
    }));

    const result = await resolveDroppedLinkFromDataTransfer(
      makeDataTransfer({ files: [file] }),
      { storagePath: 'C:\\Storage' },
    );

    expect(window.electronAPI!.outlook.saveDroppedMail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      insertedText: 'Spec review "C:\\Mail Store\\Spec review.msg"',
      type: 'outlook',
      target: 'C:\\Mail Store\\Spec review.msg',
      targetType: 'path',
    });
  });
});
