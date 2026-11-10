/**
 * ROCK UC FOODS - Site Content Types
 * Playbook v9 Section 25 (Phase 2A)
 */

export interface ContactContent {
  whatsapp: string;
  phone: string;
  showEmail: boolean;
  email: string;
  showAddress: boolean;
  address: string;
  city: 'Lagos';
}

export interface HoursContent {
  orderingOpen247: boolean;
  kitchenNote: string;
  leadTimeHours: number; // 1 to 168 (default 24)
}

export interface SectionContent {
  categorySlug: string;
  displayName: string; // 1 to 40 characters
  plainLabel: string; // 1 to 60 characters
  sortOrder: number;
}

export interface ReviewContent {
  quote: string; // 1 to 400 characters
  name: string; // 1 to 60 characters
  dateText: string; // up to 20 characters
  permissionConfirmed: boolean;
}

export interface SiteContent {
  contact: ContactContent;
  hours: HoursContent;
  sections: SectionContent[];
  reviews: ReviewContent[];
}

export interface SiteContentVersion {
  version: number;
  content: SiteContent;
  note?: string;
  createdBy: string;
  createdAt: string;
}

export const DEFAULT_LEAD_TIME_HOURS = 24;

export const DEFAULT_SITE_CONTENT: SiteContent = {
  contact: {
    whatsapp: '+2348033729125',
    phone: '08033729125',
    showEmail: false,
    email: 'rock-uc-foods@gmail.com',
    showAddress: false,
    address: '5 Aro street, Lagos',
    city: 'Lagos',
  },
  hours: {
    orderingOpen247: true,
    kitchenNote: 'Fresh dishes cooked to order daily; kitchen operates standard daytime service.',
    leadTimeHours: 24,
  },
  sections: [
    { categorySlug: 'party-jollof', displayName: 'The Jollof Table', plainLabel: 'Party Jollof and Fried Rice', sortOrder: 1 },
    { categorySlug: 'soups-swallow', displayName: 'Heritage Pots', plainLabel: 'Soups and Swallow', sortOrder: 2 },
    { categorySlug: 'pepper-soup', displayName: 'First Fire', plainLabel: 'Pepper Soup and Starters', sortOrder: 3 },
    { categorySlug: 'suya-grills', displayName: 'Smoke and Spice', plainLabel: 'Suya and Grills', sortOrder: 4 },
    { categorySlug: 'party-packs', displayName: 'Feast for the Table', plainLabel: 'Party Packs and Catering', sortOrder: 5 },
    { categorySlug: 'sides-extras', displayName: 'Side Stories', plainLabel: 'Sides and Extras', sortOrder: 6 },
    { categorySlug: 'desserts', displayName: 'Sweet Endings', plainLabel: 'Desserts and Small Chops', sortOrder: 7 },
    { categorySlug: 'drinks', displayName: 'Cool Pours', plainLabel: 'Drinks', sortOrder: 8 },
  ],
  reviews: [],
};
