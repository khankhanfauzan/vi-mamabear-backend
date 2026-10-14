import { appendDisclaimer, EDUCATIONAL_DISCLAIMER } from './reply-disclaimer';

describe('appendDisclaimer', () => {
  it('should append the disclaimer to a reply', () => {
    const result = appendDisclaimer('Ini jawaban edukatif.');

    expect(result).toBe(`Ini jawaban edukatif.\n\n${EDUCATIONAL_DISCLAIMER}`);
  });

  it('should separate the disclaimer with exactly two newline characters', () => {
    const result = appendDisclaimer('Ini jawaban edukatif.\n');

    expect(result).toBe(`Ini jawaban edukatif.\n\n${EDUCATIONAL_DISCLAIMER}`);
  });

  it('should not duplicate the disclaimer', () => {
    const reply = `Ini jawaban edukatif.\n\n${EDUCATIONAL_DISCLAIMER}`;

    expect(appendDisclaimer(reply)).toBe(reply);
  });

  it('should remove trailing whitespace before appending the disclaimer', () => {
    const result = appendDisclaimer('Ini jawaban edukatif.   \n  ');

    expect(result).toBe(`Ini jawaban edukatif.\n\n${EDUCATIONAL_DISCLAIMER}`);
  });

  it('should handle an empty reply', () => {
    expect(appendDisclaimer('')).toBe(EDUCATIONAL_DISCLAIMER);
  });
});
