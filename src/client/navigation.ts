import { LayoutDashboard, Wallet, CalendarDays, Store, Sparkles } from 'lucide-react';

export const navigation = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'budget', label: 'Budget', Icon: Wallet },
  { id: 'timeline', label: 'Timeline', Icon: CalendarDays },
  { id: 'vendors', label: 'Vendors', Icon: Store },
  { id: 'ideas', label: 'Ideas & inspiration', Icon: Sparkles },
] as const;
