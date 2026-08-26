export const startOfDay = (dateStr: string) => new Date(`${dateStr}T00:00:00.000Z`);
export const endOfDay = (dateStr: string) => new Date(`${dateStr}T23:59:59.999Z`);
