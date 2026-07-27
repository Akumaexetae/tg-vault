import { describe, expect, it } from 'vitest';
import {
  FOLDER_MIME,
  childrenQuery,
  extractDriveId,
  folderUrl,
  isDriveUrl,
  needsRefresh,
  sortDriveFiles,
  type DriveFile,
} from './drive';

describe('extractDriveId', () => {
  it('reads a shared folder link', () => {
    expect(
      extractDriveId('https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i'),
    ).toBe('1a2B3c4D5e6F7g8H9i');
  });

  it('reads a multi-account folder link', () => {
    expect(
      extractDriveId('https://drive.google.com/drive/u/0/folders/1a2B3c4D5e6F7g8H9i'),
    ).toBe('1a2B3c4D5e6F7g8H9i');
  });

  it('reads a single file link', () => {
    expect(
      extractDriveId('https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i/view?usp=sharing'),
    ).toBe('1a2B3c4D5e6F7g8H9i');
  });

  it('reads an older open?id= link', () => {
    expect(
      extractDriveId('https://drive.google.com/open?id=1a2B3c4D5e6F7g8H9i'),
    ).toBe('1a2B3c4D5e6F7g8H9i');
  });

  it('ignores query junk after the id', () => {
    expect(
      extractDriveId('https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i?usp=drive_link'),
    ).toBe('1a2B3c4D5e6F7g8H9i');
  });

  it('returns null for anything that is not a Drive link', () => {
    expect(extractDriveId('')).toBeNull();
    expect(extractDriveId('https://onlyfans.com/bella')).toBeNull();
    expect(extractDriveId('just some text')).toBeNull();
  });
});

describe('isDriveUrl', () => {
  it('recognises drive and docs hosts', () => {
    expect(isDriveUrl('https://drive.google.com/drive/folders/abc1234567')).toBe(true);
    expect(isDriveUrl('https://docs.google.com/document/d/abc1234567')).toBe(true);
  });

  it('rejects other hosts and rubbish', () => {
    expect(isDriveUrl('https://dropbox.com/x')).toBe(false);
    expect(isDriveUrl('not a url')).toBe(false);
  });

  it('is not fooled by a lookalike host', () => {
    expect(isDriveUrl('https://drive.google.com.evil.test/x')).toBe(false);
  });
});

describe('folderUrl', () => {
  it('builds a canonical folder link', () => {
    expect(folderUrl('abc123')).toBe('https://drive.google.com/drive/folders/abc123');
  });
});

describe('needsRefresh', () => {
  const now = 1_000_000;

  it('is true when there is no expiry yet', () => {
    expect(needsRefresh(null, now)).toBe(true);
  });

  it('is false while the token has comfortable life left', () => {
    expect(needsRefresh(now + 10 * 60 * 1000, now)).toBe(false);
  });

  it('refreshes early rather than racing the expiry', () => {
    expect(needsRefresh(now + 30 * 1000, now)).toBe(true);
  });

  it('is true once expired', () => {
    expect(needsRefresh(now - 1, now)).toBe(true);
  });
});

describe('sortDriveFiles', () => {
  it('puts folders first, then files, each alphabetically', () => {
    const files: DriveFile[] = [
      { id: '1', name: 'zeta.jpg', mimeType: 'image/jpeg' },
      { id: '2', name: 'Beta', mimeType: FOLDER_MIME },
      { id: '3', name: 'alpha.mp4', mimeType: 'video/mp4' },
      { id: '4', name: 'Alpha', mimeType: FOLDER_MIME },
    ];
    expect(sortDriveFiles(files).map((f) => f.name)).toEqual([
      'Alpha',
      'Beta',
      'alpha.mp4',
      'zeta.jpg',
    ]);
  });

  it('does not mutate the input', () => {
    const files: DriveFile[] = [
      { id: '1', name: 'b', mimeType: 'image/jpeg' },
      { id: '2', name: 'a', mimeType: 'image/jpeg' },
    ];
    sortDriveFiles(files);
    expect(files[0].name).toBe('b');
  });
});

describe('childrenQuery', () => {
  it('builds a parents query', () => {
    expect(childrenQuery('abc123')).toBe("'abc123' in parents and trashed = false");
  });

  it('escapes quotes so a crafted id cannot break out of the query', () => {
    expect(childrenQuery("a'b")).toBe("'a\\'b' in parents and trashed = false");
  });
});
