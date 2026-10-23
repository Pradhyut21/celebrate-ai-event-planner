export type Section = 'overview' | 'budget' | 'timeline' | 'vendors' | 'ideas';
export type Notice = { text: string; kind: 'success' | 'error' | 'info' };
export type Health = { aiEnabled: boolean; tokenRequired: boolean };
