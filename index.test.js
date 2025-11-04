import { describe, it, expect, vi } from 'vitest';
import { SPECIAL_PAGES, isSystemPage, isPageEmpty, hasNoLinkedReferences, findOrphanedPages } from './index.js';

describe('isSystemPage', () => {
  it('should return false for journal pages', () => {
    const page = { name: '2025-11-04', 'journal?': true };
    expect(isSystemPage(page)).toBe(false);
  });

  it('should return true for logseq system pages', () => {
    const page = { name: 'logseq/config', 'journal?': false };
    expect(isSystemPage(page)).toBe(true);
  });

  it('should return true for contents page', () => {
    const page = { name: 'contents', 'journal?': false };
    expect(isSystemPage(page)).toBe(true);
  });

  it('should return true for favorites page', () => {
    const page = { name: 'favorites', 'journal?': false };
    expect(isSystemPage(page)).toBe(true);
  });

  it('should return true for card page', () => {
    const page = { name: 'card', 'journal?': false };
    expect(isSystemPage(page)).toBe(true);
  });

  it('should be case-insensitive for special pages', () => {
    expect(isSystemPage({ name: 'Contents', 'journal?': false })).toBe(true);
    expect(isSystemPage({ name: 'FAVORITES', 'journal?': false })).toBe(true);
    expect(isSystemPage({ name: 'Card', 'journal?': false })).toBe(true);
  });

  it('should return false for regular pages', () => {
    const page = { name: 'my-page', 'journal?': false };
    expect(isSystemPage(page)).toBe(false);
  });
});

describe('isPageEmpty', () => {
  it('should return true for page with no blocks', () => {
    const page = { name: 'test-page', 'journal?': false };
    const blocks = [];

    expect(isPageEmpty(page, blocks)).toBe(true);
  });

  it('should return true for page with empty block', () => {
    const page = { name: 'test-page', 'journal?': false };
    const blocks = [{ content: '' }];

    expect(isPageEmpty(page, blocks)).toBe(true);
  });

  it('should return true for page with whitespace-only block', () => {
    const page = { name: 'test-page', 'journal?': false };
    const blocks = [{ content: '   ' }];

    expect(isPageEmpty(page, blocks)).toBe(true);
  });

  it('should return true for page with dash-only block', () => {
    const page = { name: 'test-page', 'journal?': false };
    const blocks = [{ content: '-' }];

    expect(isPageEmpty(page, blocks)).toBe(true);
  });

  it('should return true for page with asterisk-only block', () => {
    const page = { name: 'test-page', 'journal?': false };
    const blocks = [{ content: '*' }];

    expect(isPageEmpty(page, blocks)).toBe(true);
  });

  it('should return false for page with actual content', () => {
    const page = { name: 'test-page', 'journal?': false };
    const blocks = [{ content: 'Some content' }];

    expect(isPageEmpty(page, blocks)).toBe(false);
  });

  it('should return true for empty journal pages', () => {
    const page = { name: '2025-11-03', 'journal?': true };
    const blocks = [];

    expect(isPageEmpty(page, blocks)).toBe(true);
  });

  it('should return false for logseq system pages', () => {
    const page = { name: 'logseq/config', 'journal?': false };
    const blocks = [];

    expect(isPageEmpty(page, blocks)).toBe(false);
  });

  it('should return false for special pages (contents, favorites, card)', () => {
    expect(isPageEmpty({ name: 'contents', 'journal?': false }, [])).toBe(false);
    expect(isPageEmpty({ name: 'favorites', 'journal?': false }, [])).toBe(false);
    expect(isPageEmpty({ name: 'card', 'journal?': false }, [])).toBe(false);
  });

  it('should return false for pages with multiple blocks', () => {
    const page = { name: 'test-page', 'journal?': false };
    const blocks = [
      { content: 'First block' },
      { content: 'Second block' }
    ];

    expect(isPageEmpty(page, blocks)).toBe(false);
  });

  it('should handle null blocks', () => {
    const page = { name: 'test-page', 'journal?': false };
    const blocks = null;

    expect(isPageEmpty(page, blocks)).toBe(true);
  });

  it('should handle undefined blocks', () => {
    const page = { name: 'test-page', 'journal?': false };
    const blocks = undefined;

    expect(isPageEmpty(page, blocks)).toBe(true);
  });
});

describe('hasNoLinkedReferences', () => {
  it('should return true when references is null', () => {
    expect(hasNoLinkedReferences(null)).toBe(true);
  });

  it('should return true when references is undefined', () => {
    expect(hasNoLinkedReferences(undefined)).toBe(true);
  });

  it('should return true when references is empty array', () => {
    expect(hasNoLinkedReferences([])).toBe(true);
  });

  it('should return false when references has items', () => {
    expect(hasNoLinkedReferences([['some-page', []]])).toBe(false);
  });
});

describe('findOrphanedPages', () => {
  it('should find empty pages with no linked references', async () => {
    const mockApi = {
      Editor: {
        getAllPages: vi.fn().mockResolvedValue([
          { name: 'empty-page-1', 'journal?': false },
          { name: 'empty-page-2', 'journal?': false },
          { name: 'page-with-content', 'journal?': false }
        ]),
        getPageBlocksTree: vi.fn((pageName) => {
          if (pageName === 'page-with-content') {
            return Promise.resolve([{ content: 'Some content' }]);
          }
          return Promise.resolve([]);
        }),
        getPageLinkedReferences: vi.fn().mockResolvedValue([])
      }
    };

    const orphans = await findOrphanedPages(mockApi);

    expect(orphans).toEqual(['empty-page-1', 'empty-page-2']);
    expect(mockApi.Editor.getAllPages).toHaveBeenCalledOnce();
  });

  it('should not include empty pages that have linked references', async () => {
    const mockApi = {
      Editor: {
        getAllPages: vi.fn().mockResolvedValue([
          { name: 'empty-with-refs', 'journal?': false },
          { name: 'empty-no-refs', 'journal?': false }
        ]),
        getPageBlocksTree: vi.fn().mockResolvedValue([]),
        getPageLinkedReferences: vi.fn((pageName) => {
          if (pageName === 'empty-with-refs') {
            return Promise.resolve([['referencing-page', []]]);
          }
          return Promise.resolve([]);
        })
      }
    };

    const orphans = await findOrphanedPages(mockApi);

    expect(orphans).toEqual(['empty-no-refs']);
  });

  it('should include empty journal pages with no references', async () => {
    const mockApi = {
      Editor: {
        getAllPages: vi.fn().mockResolvedValue([
          { name: '2025-11-03', 'journal?': true },
          { name: 'empty-page', 'journal?': false }
        ]),
        getPageBlocksTree: vi.fn().mockResolvedValue([]),
        getPageLinkedReferences: vi.fn().mockResolvedValue([])
      }
    };

    const orphans = await findOrphanedPages(mockApi);

    expect(orphans).toEqual(['2025-11-03', 'empty-page']);
    expect(mockApi.Editor.getPageBlocksTree).toHaveBeenCalledTimes(2);
  });

  it('should skip logseq system pages', async () => {
    const mockApi = {
      Editor: {
        getAllPages: vi.fn().mockResolvedValue([
          { name: 'logseq/config', 'journal?': false },
          { name: 'logseq/pages', 'journal?': false },
          { name: 'empty-page', 'journal?': false }
        ]),
        getPageBlocksTree: vi.fn().mockResolvedValue([]),
        getPageLinkedReferences: vi.fn().mockResolvedValue([])
      }
    };

    const orphans = await findOrphanedPages(mockApi);

    expect(orphans).toEqual(['empty-page']);
    expect(mockApi.Editor.getPageBlocksTree).toHaveBeenCalledTimes(1);
  });

  it('should skip special pages (contents, favorites, card)', async () => {
    const mockApi = {
      Editor: {
        getAllPages: vi.fn().mockResolvedValue([
          { name: 'contents', 'journal?': false },
          { name: 'favorites', 'journal?': false },
          { name: 'card', 'journal?': false },
          { name: 'empty-page', 'journal?': false }
        ]),
        getPageBlocksTree: vi.fn().mockResolvedValue([]),
        getPageLinkedReferences: vi.fn().mockResolvedValue([])
      }
    };

    const orphans = await findOrphanedPages(mockApi);

    expect(orphans).toEqual(['empty-page']);
    expect(mockApi.Editor.getPageBlocksTree).toHaveBeenCalledTimes(1);
  });

  it('should return empty array when no empty pages found', async () => {
    const mockApi = {
      Editor: {
        getAllPages: vi.fn().mockResolvedValue([
          { name: 'page-with-content', 'journal?': false }
        ]),
        getPageBlocksTree: vi.fn().mockResolvedValue([{ content: 'Content' }]),
        getPageLinkedReferences: vi.fn().mockResolvedValue([])
      }
    };

    const orphans = await findOrphanedPages(mockApi);

    expect(orphans).toEqual([]);
  });

  it('should detect empty journal pages as orphans', async () => {
    const mockApi = {
      Editor: {
        getAllPages: vi.fn().mockResolvedValue([
          { name: '2025-11-01', 'journal?': true },
          { name: '2025-11-02', 'journal?': true }
        ]),
        getPageBlocksTree: vi.fn().mockResolvedValue([]),
        getPageLinkedReferences: vi.fn().mockResolvedValue([])
      }
    };

    const orphans = await findOrphanedPages(mockApi);

    expect(orphans).toEqual(['2025-11-01', '2025-11-02']);
    expect(mockApi.Editor.getPageBlocksTree).toHaveBeenCalledTimes(2);
    expect(mockApi.Editor.getPageLinkedReferences).toHaveBeenCalledTimes(2);
  });

  it('should identify pages with dash-only content as empty if no refs', async () => {
    const mockApi = {
      Editor: {
        getAllPages: vi.fn().mockResolvedValue([
          { name: 'page-with-dash', 'journal?': false }
        ]),
        getPageBlocksTree: vi.fn().mockResolvedValue([{ content: '-' }]),
        getPageLinkedReferences: vi.fn().mockResolvedValue([])
      }
    };

    const orphans = await findOrphanedPages(mockApi);

    expect(orphans).toEqual(['page-with-dash']);
  });

  it('should identify pages with asterisk-only content as empty if no refs', async () => {
    const mockApi = {
      Editor: {
        getAllPages: vi.fn().mockResolvedValue([
          { name: 'page-with-asterisk', 'journal?': false }
        ]),
        getPageBlocksTree: vi.fn().mockResolvedValue([{ content: '*' }]),
        getPageLinkedReferences: vi.fn().mockResolvedValue([])
      }
    };

    const orphans = await findOrphanedPages(mockApi);

    expect(orphans).toEqual(['page-with-asterisk']);
  });

  it('should handle API errors gracefully', async () => {
    const mockApi = {
      Editor: {
        getAllPages: vi.fn().mockResolvedValue([
          { name: 'error-page', 'journal?': false },
          { name: 'good-page', 'journal?': false }
        ]),
        getPageBlocksTree: vi.fn((pageName) => {
          if (pageName === 'error-page') {
            return Promise.reject(new Error('API error'));
          }
          return Promise.resolve([]);
        }),
        getPageLinkedReferences: vi.fn().mockResolvedValue([])
      }
    };

    const orphans = await findOrphanedPages(mockApi);

    expect(orphans).toEqual(['good-page']);
  });
});
