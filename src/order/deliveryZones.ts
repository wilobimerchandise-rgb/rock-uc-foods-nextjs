/**
 * ROCK UC FOODS - Delivery Zones Configuration & Pricing
 * (Playbook v2 Section 8 & Section 17 v3 Addendum)
 * All fees strictly BigInt kobo.
 */

import { DeliveryZone } from '../types/order';
import { recordAuditEvent } from '../lib/auth';

const INITIAL_LAGOS_DELIVERY_ZONES: DeliveryZone[] = [
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

function cloneZone(z: DeliveryZone): DeliveryZone {
  return { ...z, areas: [...z.areas] };
}

export const LAGOS_DELIVERY_ZONES: DeliveryZone[] = INITIAL_LAGOS_DELIVERY_ZONES.map(cloneZone);

export function getAllDeliveryZones(includeInactive: boolean = false): DeliveryZone[] {
  const list = includeInactive
    ? LAGOS_DELIVERY_ZONES
    : LAGOS_DELIVERY_ZONES.filter((z) => z.isActive);
  return list.slice().sort((a, b) => a.sortOrder - b.sortOrder).map(cloneZone);
}

export function getDeliveryZoneById(id?: string): DeliveryZone | undefined {
  if (!id) return undefined;
  return LAGOS_DELIVERY_ZONES.find((z) => z.id === id || z.code === id);
}

export function calculateDeliveryFeeKobo(type: 'delivery' | 'collection', zoneId?: string): bigint {
  if (type === 'collection') {
    return 0n;
  }
  const zone = getDeliveryZoneById(zoneId);
  if (!zone || !zone.isActive) {
    throw new Error('Please select an active delivery zone for Lagos delivery.');
  }
  return zone.feeKobo;
}

export interface UpdateDeliveryZoneInput {
  id: string;
  feeKobo?: bigint;
  isActive?: boolean;
  name?: string;
  areas?: string[];
  actorId: string;
  actorRole: string;
}

export function updateDeliveryZone(input: UpdateDeliveryZoneInput): DeliveryZone {
  if (input.actorRole !== 'owner') {
    throw new Error('Only owner accounts may update delivery zone pricing or status.');
  }

  const zone = getDeliveryZoneById(input.id);
  if (!zone) {
    throw new Error(`Delivery zone '${input.id}' not found.`);
  }

  if (input.feeKobo !== undefined && input.feeKobo < 0n) {
    throw new Error('Delivery fee cannot be negative.');
  }

  if (input.name !== undefined && input.name.trim().length < 2) {
    throw new Error('Delivery zone name must be at least 2 characters.');
  }

  const before = {
    name: zone.name,
    feeKobo: zone.feeKobo.toString(),
    isActive: zone.isActive,
    areas: [...zone.areas],
  };

  if (input.feeKobo !== undefined) {
    zone.feeKobo = input.feeKobo;
  }
  if (input.isActive !== undefined) {
    zone.isActive = input.isActive;
  }
  if (input.name !== undefined) {
    zone.name = input.name.trim();
  }
  if (input.areas !== undefined) {
    const cleanedAreas = input.areas.map((a) => a.trim()).filter(Boolean);
    if (cleanedAreas.length === 0) {
      throw new Error('Delivery zone must cover at least one Lagos area.');
    }
    zone.areas = cleanedAreas;
  }

  recordAuditEvent({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'UPDATE_DELIVERY_ZONE',
    entity: 'delivery_zones',
    entityId: zone.id,
    before,
    after: {
      name: zone.name,
      feeKobo: zone.feeKobo.toString(),
      isActive: zone.isActive,
      areas: [...zone.areas],
    },
  });

  return cloneZone(zone);
}

export function resetDeliveryZonesForTesting(): void {
  LAGOS_DELIVERY_ZONES.length = 0;
  for (const z of INITIAL_LAGOS_DELIVERY_ZONES) {
    LAGOS_DELIVERY_ZONES.push(cloneZone(z));
  }
}
