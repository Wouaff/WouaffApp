import type { SuggestedUser, TrendItem } from '../types';

export const MOCK_TRENDS: TrendItem[] = [
  { tag: 'SouverainetéNumérique', category: 'Technologie · Tendances en France', posts: '48,2 k' },
  { tag: 'MadeInFrance', category: 'Tendances en France', posts: '36,1 k' },
  { tag: 'Wouaff', category: 'Tendances en France', posts: '25,7 k' },
  { tag: 'TechFrançaise', category: 'Technologie · Tendances en France', posts: '18,4 k' },
  { tag: 'Paris', category: 'Tendances en France', posts: '12,8 k' },
  { tag: 'RGPD', category: 'Sécurité · Tendances en France', posts: '9,3 k' },
];

export const MOCK_SUGGESTIONS: SuggestedUser[] = [
  { pseudo: 'Tech France', handle: '@techfrance_news', bio: "L'actu tech 100% made in France" },
  { pseudo: 'Culture Hexagone', handle: '@culture_hexagone', bio: 'Culture & patrimoine français' },
  { pseudo: 'Startup France', handle: '@startup_france', bio: "L'écosystème French Tech" },
];
