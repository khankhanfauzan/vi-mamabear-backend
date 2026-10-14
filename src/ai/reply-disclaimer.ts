export const EDUCATIONAL_DISCLAIMER =
  'Catatan: Informasi ini bersifat edukatif dan bukan pengganti saran, diagnosis, atau penanganan dari tenaga medis/dokter profesional.';

export function appendDisclaimer(reply: string): string {
  const cleanReply = reply.trimEnd();

  if (cleanReply.endsWith(EDUCATIONAL_DISCLAIMER)) {
    return cleanReply;
  }

  if (!cleanReply) {
    return EDUCATIONAL_DISCLAIMER;
  }

  return `${cleanReply}\n\n${EDUCATIONAL_DISCLAIMER}`;
}
