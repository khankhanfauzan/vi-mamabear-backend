export function truncateReply(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) {
    return text;
  }

  if (maxLength <= 3) {
    return '.'.repeat(Math.max(0, maxLength));
  }

  const truncated = text.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  const cleanText =
    lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;

  return `${cleanText}...`;
}
