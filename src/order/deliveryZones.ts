/**
 * ROCK UC FOODS - Delivery Zones Configuration & Pricing
 * (Playbook v2 Section 8 & Section 17 v3 Addendum)
 * All fees strictly BigInt kobo.
 */

import { DeliveryZone } from '../types/order';

export const LAGOS_DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: 'zone-1-ikeja',
    code: 'ZONE_1',
    name: 'Zone 1: Ikeja & Environs',
    areas: ['Ikeja', 'Maryland', 'Opebi', 'Allen', 'Ojodu', 'Alausa'],
    feeKobo: 250000n, // ₦2,500.00
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'zone-2-island',
    code: 'ZONE_2',
    name: 'Zone 2: Island Core',
    areas: ['Victoria Island', 'Ikoyi', 'Lekki Phase 1', 'Oniru'],
    feeKobo: 350000n, // ₦3,500.00
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'zone-3-mainland',
    code: 'ZONE_3',
    name: 'Zone 3: Central Mainland',
    areas: ['Surulere', 'Yaba', 'Gbagada', 'Magodo', 'Anthony', 'Ilpeju'],
    feeKobo: 300000n, // ₦3,000.00
    isActive: true,
    sortOrder: 3,
  },
  {
    id: 'zone-4-lekki-ajah',
    code: 'ZONE_4',
    name: 'Zone 4: Greater Island',
    areas: ['Lekki beyond Chevron', 'Ajah', 'Sangotedo', 'Jakande'],
    feeKobo: 450000n, // ₦4,500.00
    isActive: true,
    sortOrder: 4,
  },
  {
    id: 'zone-5-outer',
    code: 'ZONE_5',
    name: 'Zone 5: Outer Mainland',
    areas: ['Festac', 'Amuwo', 'Alimosho', 'Ikorodu', 'Agege'],
    feeKobo: 500000n, // ₦5,000.00
    isActive: true,
    sortOrder: 5,
  },
];

export function getDeliveryZoneById(id?: string): DeliveryZone | undefined {
  if (!id) return undefined;
  return LAGOS_DELIVERY_ZONES.find((z) => z.id === id || z.code === id);
}

export function calculateDeliveryFeeKobo(type: 'delivery' | 'collection', zoneId?: string): bigint {
  if (type === 'collection') {
    return 0n;
  }
  const zone = getDeliveryZoneById(zoneId);
  if (!zone) {
    throw new Error('Please select a valid delivery zone for Lagos delivery.');
  }
  return zone.feeKobo;
}
