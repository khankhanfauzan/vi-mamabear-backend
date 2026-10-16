import { truncateReply } from './reply-truncation';

describe('truncateReply', () => {
  it('should return the original text if within the limit', () => {
    expect(truncateReply('Halo teman')).toBe('Halo teman');
  });

  it('should return the original text if exactly at the limit', () => {
    const text = 'a'.repeat(500);

    expect(truncateReply(text)).toBe(text);
  });

  it('should truncate long text and add ellipsis', () => {
    const text = 'kata '.repeat(120);
    const result = truncateReply(text);

    expect(result.length).toBeLessThanOrEqual(500);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should avoid cutting a word in the middle', () => {
    const text = `${'kata '.repeat(99)}panjangsekali`;
    const result = truncateReply(text, 500);

    expect(result.endsWith('...')).toBe(true);
    expect(result).not.toMatch(/panjangsekali\.\.\.$/);
  });

  it('should handle a maximum length of 3', () => {
    expect(truncateReply('teks panjang', 3)).toBe('...');
  });

  it('should handle a maximum length below 3', () => {
    expect(truncateReply('teks panjang', 2)).toBe('..');
  });

  it('should handle a maximum length of 0', () => {
    expect(truncateReply('teks panjang', 0)).toBe('');
  });

  it('should truncate long text without spaces', () => {
    expect(truncateReply('abcdefghijklmnopqrst', 10)).toBe('abcdefg...');
  });
});
