'use client';

/**
 * ROCK UC FOODS - Mobile-First Owner Menu Editor
 * (Playbook v2 Section 7.A, Decision 2 & Section 35)
 * Staff can only toggle availability; Owner manages prices, edits, versions, and CSV.
 */

import React, { useState, useRef } from 'react';
import { menuRepository } from '../../menu/data';
import { formatNaira, parseNairaToKobo } from '../../lib/money';
import { MenuItem, MenuItemVersionRecord, MenuOptionGroup, SizeTier } from '../../types/menu';
import { dryRunMenuCsv, commitMenuCsv, exportMenuToCsv, CsvDryRunResult } from '../../menu/import';
import {
  Plus,
  Upload,
  Download,
  ArrowUp,
  ArrowDown,
  History,
  Archive,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Edit2,
  X,
  Lock,
  Camera,
  Check,
  Image as ImageIcon,
  Layers,
  ListPlus,
  Trash2,
} from 'lucide-react';
import { FounderPhotoModal } from '../brand/FounderPhoto';

interface OwnerMenuEditorProps {
  currentUserRole: 'owner' | 'staff' | 'developer';
  currentUserId: string;
}

function formatKoboForInput(kobo: bigint): string {
  const whole = kobo / 100n;
  const rem = kobo % 100n;
  return `${whole.toString()}.${rem.toString().padStart(2, '0')}`;
}

export const OwnerMenuEditor: React.FC<OwnerMenuEditorProps> = ({
  currentUserRole,
  currentUserId,
}) => {
  const isOwnerOrDev = currentUserRole === 'owner' || currentUserRole === 'developer';

  const [, setRefreshTrigger] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formPriceNaira, setFormPriceNaira] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPortion, setFormPortion] = useState('Serves 1');
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft');
  const [formFeatured, setFormFeatured] = useState(false);

  // Phase 2B Extensions: Pricing mode (Single vs Size Tiers), Option Groups, Photos, Metadata
  const [formPricingMode, setFormPricingMode] = useState<'single' | 'tiers'>('single');
  const [formTiers, setFormTiers] = useState<Array<{ id: string; label: string; priceNaira: string; active: boolean }>>([]);
  const [formOptionGroups, setFormOptionGroups] = useState<
    Array<{
      id: string;
      name: string;
      minSelect: number;
      maxSelect: number;
      options: Array<{ id: string; name: string; priceDeltaNaira: string; isAvailable: boolean }>;
    }>
  >([]);
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [formImageAlt, setFormImageAlt] = useState('');
  const [formShowHeat, setFormShowHeat] = useState(false);
  const [formAvailabilityNote, setFormAvailabilityNote] = useState('');
  const [formAllergensCsv, setFormAllergensCsv] = useState('');
  const dishPhotoInputRef = useRef<HTMLInputElement>(null);

  // Price change confirmation dialog
  const [priceChangeConfirmation, setPriceChangeConfirmation] = useState<{
    item: MenuItem;
    oldPriceKobo: bigint;
    newPriceKobo: bigint;
  } | null>(null);

  // Version history state
  const [versionHistoryItem, setVersionHistoryItem] = useState<MenuItem | null>(null);
  const [versionsList, setVersionsList] = useState<MenuItemVersionRecord[]>([]);

  // CSV Import state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [rawCsvInput, setRawCsvInput] = useState('');
  const [dryRunReport, setDryRunReport] = useState<CsvDryRunResult | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Founder Photo modal state
  const [showFounderModal, setShowFounderModal] = useState(false);

  // Success / error notification banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const categories = menuRepository.getCategories(true);
  const allItems = menuRepository.getAllItemsForAdmin();

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);

  const filteredItems = allItems.filter((item) => {
    if (filterStatus === 'published' && item.status !== 'published') return false;
    if (filterStatus === 'draft' && item.status !== 'draft') return false;
    if (filterStatus === 'archived' && item.status !== 'archived') return false;
    if (filterStatus === 'sold_out' && !menuRepository.isItemSoldOutToday(item)) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchSku = item.sku.toLowerCase().includes(q);
      return matchName || matchSku;
    }
    return true;
  });

  const handleToggleSoldOut = (item: MenuItem) => {
    try {
      menuRepository.toggleSoldOutToday(item.id, currentUserId, currentUserRole);
      notify(
        `Updated ${item.name}: ${
          menuRepository.isItemSoldOutToday(item)
            ? 'Marked sold out today (resets at Lagos midnight).'
            : 'Sold-out status cleared.'
        }`
      );
      handleRefresh();
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const handleToggleAvailability = (item: MenuItem) => {
    try {
      menuRepository.toggleAvailability(item.id, currentUserId, currentUserRole);
      notify(`Updated ${item.name}: ${item.isAvailable ? 'Available' : 'Unavailable'}`);
      handleRefresh();
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const handleReorder = (itemId: string, direction: 'up' | 'down') => {
    if (!isOwnerOrDev) {
      notify('Reordering menu items requires owner role.', 'error');
      return;
    }
    menuRepository.reorderItem(itemId, direction);
    handleRefresh();
  };

  const openEditModal = (item: MenuItem) => {
    if (!isOwnerOrDev) {
      notify('Staff accounts can only toggle daily availability and sold out status.', 'error');
      return;
    }
    const hasTiers = Boolean(item.sizeTiers && item.sizeTiers.length > 0);
    setEditingItem(item);
    setIsNewItem(false);
    setFormName(item.name);
    setFormCategoryId(item.categoryId);
    setFormPriceNaira(formatKoboForInput(item.priceKobo));
    setFormDescription(item.description || '');
    setFormPortion(item.portionLabel || 'Serves 1');
    setFormStatus(item.status === 'archived' ? 'draft' : item.status);
    setFormFeatured(item.isFeatured);
    setFormPricingMode(hasTiers ? 'tiers' : 'single');
    setFormTiers(
      hasTiers
        ? item.sizeTiers!.map((t) => ({
            id: t.id,
            label: t.label,
            priceNaira: formatKoboForInput(t.priceKobo),
            active: t.active,
          }))
        : []
    );
    setFormOptionGroups(
      (item.optionGroups || []).map((g) => ({
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDeltaNaira: formatKoboForInput(o.priceDeltaKobo),
          isAvailable: o.isAvailable,
        })),
      }))
    );
    setFormPhotoUrl(item.photoUrl || item.imagePath || '');
    setFormImageAlt(item.imageAlt || '');
    setFormShowHeat(Boolean(item.showHeat));
    setFormAvailabilityNote(item.availabilityNote || '');
    setFormAllergensCsv((item.allergens || []).join(', '));
  };

  const openNewItemModal = () => {
    if (!isOwnerOrDev) {
      notify('Staff accounts cannot create dishes. Owner role required.', 'error');
      return;
    }
    setEditingItem(null);
    setIsNewItem(true);
    setFormName('');
    setFormCategoryId(categories[0]?.id || '');
    setFormPriceNaira('');
    setFormDescription('');
    setFormPortion('Serves 1');
    setFormStatus('draft');
    setFormFeatured(false);
    setFormPricingMode('single');
    setFormTiers([]);
    setFormOptionGroups([]);
    setFormPhotoUrl('');
    setFormImageAlt('');
    setFormShowHeat(false);
    setFormAvailabilityNote('');
    setFormAllergensCsv('');
  };

  const buildStructuredPayload = (basePriceKobo: bigint) => {
    const itemIdForChildren = editingItem?.id || `item-${Date.now()}`;

    let sizeTiers: SizeTier[] = [];
    let resolvedBasePrice = basePriceKobo;

    if (formPricingMode === 'tiers') {
      if (formTiers.length === 0) {
        throw new Error('Add at least one size tier or switch back to Single Base Price.');
      }
      sizeTiers = formTiers.map((t, idx) => {
        const label = t.label.trim();
        if (!label) {
          throw new Error(`Size tier #${idx + 1} requires a label (e.g. S, M, L).`);
        }
        const tierKobo = parseNairaToKobo(t.priceNaira);
        if (tierKobo <= 0n) {
          throw new Error(`Size tier "${label}" price must be greater than ₦0.00.`);
        }
        return {
          id: t.id || `tier-${itemIdForChildren}-${idx + 1}`,
          itemId: itemIdForChildren,
          label,
          priceKobo: tierKobo,
          active: t.active,
          sortOrder: idx + 1,
        };
      });
      // Phase 2B Invariant: item has EITHER base price OR size tiers, never both
      resolvedBasePrice = 0n;
    }

    const optionGroups: MenuOptionGroup[] = formOptionGroups.map((g, gIdx) => {
      const groupName = g.name.trim();
      if (!groupName) {
        throw new Error(`Option group #${gIdx + 1} requires a title.`);
      }
      const groupId = g.id || `grp-${itemIdForChildren}-${gIdx + 1}`;
      const minSel = Math.max(0, Math.floor(Number(g.minSelect) || 0));
      const maxSel = Math.max(1, Math.floor(Number(g.maxSelect) || 1));
      if (minSel > maxSel) {
        throw new Error(`Option group "${groupName}": minSelect cannot exceed maxSelect.`);
      }
      const options = g.options.map((o, oIdx) => {
        const optName = o.name.trim();
        if (!optName) {
          throw new Error(`Option #${oIdx + 1} in "${groupName}" requires a name.`);
        }
        const deltaKobo = o.priceDeltaNaira.trim() === '' ? 0n : parseNairaToKobo(o.priceDeltaNaira);
        return {
          id: o.id || `opt-${groupId}-${oIdx + 1}`,
          groupId,
          name: optName,
          priceDeltaKobo: deltaKobo,
          isAvailable: o.isAvailable,
          sortOrder: oIdx + 1,
        };
      });
      return {
        id: groupId,
        itemId: itemIdForChildren,
        name: groupName,
        minSelect: minSel,
        maxSelect: maxSel,
        options,
      };
    });

    const trimmedPhoto = formPhotoUrl.trim();
    if (
      trimmedPhoto &&
      !trimmedPhoto.startsWith('/') &&
      !trimmedPhoto.startsWith('https://') &&
      !trimmedPhoto.startsWith('data:image/')
    ) {
      throw new Error('Dish photo must be a safe local path (/...), HTTPS URL, or uploaded image.');
    }

    const allergens = formAllergensCsv
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    return {
      resolvedBasePrice,
      sizeTiers,
      optionGroups,
      photoUrl: trimmedPhoto || undefined,
      imagePath: trimmedPhoto || undefined,
      imageAlt: formImageAlt.trim() || undefined,
      showHeat: formShowHeat,
      availabilityNote: formAvailabilityNote.trim() || undefined,
      allergens,
    };
  };

  const handleDishPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('Please upload a JPG, PNG, or WEBP dish photo.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('Dish photo must be under 5MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || '');
      if (dataUrl) {
        setFormPhotoUrl(dataUrl);
        if (!formImageAlt && formName) {
          setFormImageAlt(`${formName} plated by Rock UC Foods`);
        }
      }
    };
    reader.onerror = () => notify('Could not read selected image file.', 'error');
    reader.readAsDataURL(file);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOrDev) return;

    try {
      const parsedKobo =
        formPricingMode === 'tiers' ? 0n : parseNairaToKobo(formPriceNaira);
      const structured = buildStructuredPayload(parsedKobo);

      if (
        editingItem &&
        formPricingMode === 'single' &&
        editingItem.priceKobo !== structured.resolvedBasePrice
      ) {
        setPriceChangeConfirmation({
          item: editingItem,
          oldPriceKobo: editingItem.priceKobo,
          newPriceKobo: structured.resolvedBasePrice,
        });
        return;
      }

      commitItemSave(structured.resolvedBasePrice, structured);
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const commitItemSave = (
    priceKobo: bigint,
    precomputed?: ReturnType<typeof buildStructuredPayload>
  ) => {
    try {
      const structured = precomputed || buildStructuredPayload(priceKobo);
      menuRepository.saveItem(
        {
          id: editingItem?.id,
          categoryId: formCategoryId,
          name: formName,
          description: formDescription,
          priceKobo: structured.resolvedBasePrice,
          portionLabel: formPortion,
          allergens: structured.allergens,
          imagePath: structured.imagePath,
          imageAlt: structured.imageAlt,
          photoUrl: structured.photoUrl,
          showHeat: structured.showHeat,
          availabilityNote: structured.availabilityNote,
          sizeTiers: structured.sizeTiers,
          optionGroups: structured.optionGroups,
          status: formStatus,
          isFeatured: formFeatured,
          version: editingItem?.version,
        },
        currentUserId
      );

      setEditingItem(null);
      setIsNewItem(false);
      setPriceChangeConfirmation(null);
      notify(`Saved "${formName}" successfully.`);
      handleRefresh();
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const openVersionHistory = (item: MenuItem) => {
    setVersionHistoryItem(item);
    const history = menuRepository.getVersionsForItem(item.id);
    setVersionsList(history);
  };

  const handleRestoreVersion = (versionNum: number) => {
    if (!versionHistoryItem || !isOwnerOrDev) return;
    try {
      menuRepository.restoreVersion(versionHistoryItem.id, versionNum, currentUserId);
      notify(`Restored version ${versionNum} for ${versionHistoryItem.name}.`);
      setVersionHistoryItem(null);
      handleRefresh();
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const handleArchive = (item: MenuItem) => {
    if (!isOwnerOrDev) {
      notify('Archiving menu items requires owner role.', 'error');
      return;
    }
    try {
      menuRepository.archiveItem(item.id, currentUserId);
      notify(`Archived "${item.name}".`);
      handleRefresh();
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const handleDryRunCsv = () => {
    try {
      setCsvError(null);
      const res = dryRunMenuCsv(rawCsvInput);
      setDryRunReport(res);
    } catch (err: unknown) {
      setCsvError((err as Error).message);
    }
  };

  const handleCommitCsv = () => {
    if (!dryRunReport || !isOwnerOrDev) return;
    try {
      const { createdCount, updatedCount } = commitMenuCsv(dryRunReport, currentUserId);
      notify(`CSV Import Complete: ${createdCount} created, ${updatedCount} updated.`);
      setShowCsvModal(false);
      setRawCsvInput('');
      setDryRunReport(null);
      handleRefresh();
    } catch (err: unknown) {
      setCsvError((err as Error).message);
    }
  };

  const handleExportCsv = () => {
    const csvData = exportMenuToCsv();
    const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ROCK_UC_FOODS_Menu_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Menu CSV exported successfully.');
  };

  return (
    <div className="bg-[var(--bg-primary)] text-[var(--text-primary)] min-h-screen p-4 md:p-6 max-w-5xl mx-auto min-w-0 w-full max-w-full">
      {/* Top Banner & Notifications */}
      {notification && (
        <div
          role={notification.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-xl mb-4 text-sm font-semibold flex items-center gap-2 border ${
            notification.type === 'error'
              ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
              : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#D4AF37]" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Editor Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle-card)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[var(--text-primary)]">
              Menu Management
            </h1>
            <span
              className={`text-sm uppercase font-bold px-2.5 py-0.5 rounded-md ${
                isOwnerOrDev
                  ? 'bg-[#D4AF37] text-[#0B0A09]'
                  : 'bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border border-[var(--border-card)]'
              }`}
            >
              Role: {currentUserRole}
            </span>
          </div>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            {isOwnerOrDev
              ? 'Full catalog control: prices, portions, versions & dry-run CSV imports.'
              : 'Staff view: Toggle availability and sold-out status only.'}
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {isOwnerOrDev && (
            <button
              type="button"
              onClick={openNewItemModal}
              className="btn-luxury text-sm inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Dish
            </button>
          )}
          {isOwnerOrDev && (
            <button
              type="button"
              onClick={() => setShowCsvModal(true)}
              className="min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-primary)] px-3.5 py-2 rounded-xl text-sm font-semibold hover:border-[var(--border-gold)] inline-flex items-center gap-1.5 shrink-0"
            >
              <Upload className="w-4 h-4 text-[var(--text-accent)]" /> Import CSV
            </button>
          )}
          {isOwnerOrDev && (
            <button
              type="button"
              onClick={() => setShowFounderModal(true)}
              className="min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-primary)] px-3.5 py-2 rounded-xl text-sm font-semibold hover:border-[var(--border-gold)] inline-flex items-center gap-1.5 shrink-0"
            >
              <Camera className="w-4 h-4 text-[var(--text-accent)]" /> Founder Photo
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-subtle-card)] text-[var(--text-primary)] px-3.5 py-2 rounded-xl text-sm font-semibold hover:border-[var(--border-gold)] inline-flex items-center gap-1.5 shrink-0"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 min-w-0">
        <input
          type="text"
          aria-label="Search menu dishes"
          placeholder="Search by dish name or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)] flex-1 min-w-0"
        />

        <div className="flex gap-2 overflow-x-auto [overscroll-behavior-x:contain] no-scrollbar pb-1 min-w-0 max-w-full">
          {['all', 'published', 'draft', 'sold_out', 'archived'].map((status) => (
            <button
              type="button"
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold uppercase tracking-wider shrink-0 border ${
                filterStatus === status
                  ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]'
                  : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:text-[var(--text-primary)]'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Item List Cards */}
      <div className="space-y-3 min-w-0">
        {filteredItems.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-xl p-8 text-center border border-[var(--border-subtle-card)]">
            <p className="text-sm text-[var(--text-body-muted)]">No dishes match the selected filter.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSoldOut = menuRepository.isItemSoldOutToday(item);
            const catName = categories.find((c) => c.id === item.categoryId)?.name || 'Unassigned';

            return (
              <div
                key={item.id}
                className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all min-w-0"
              >
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-sm font-mono text-[var(--text-accent)]">{item.sku}</span>
                    <span className="text-sm bg-[var(--bg-surface-muted)] px-2.5 py-0.5 rounded-md text-[var(--text-body-muted)] border border-[var(--border-subtle-card)]">
                      {catName}
                    </span>
                    <span
                      className={`text-sm font-bold uppercase px-2.5 py-0.5 rounded-md border ${
                        item.status === 'published'
                          ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                          : item.status === 'draft'
                          ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                          : 'bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)]'
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.isFeatured && (
                      <span className="bg-[#F2C230] text-[#0B0A09] text-sm font-bold px-2.5 py-0.5 rounded-md">
                        Featured
                      </span>
                    )}
                    {isSoldOut && (
                      <span className="bg-[#B3261E] text-white text-sm font-bold px-2.5 py-0.5 rounded-md">
                        Sold out today
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-serif font-bold text-[var(--text-primary)] truncate">
                    {item.name}
                  </h3>
                  <div className="text-base font-bold text-[var(--text-accent)] price-tabular mt-0.5 flex flex-wrap items-center gap-2">
                    <span>
                      {item.sizeTiers && item.sizeTiers.length > 0
                        ? `Size Tiers: ${item.sizeTiers
                            .filter((t) => t.active)
                            .map((t) => `${t.label} ${formatNaira(t.priceKobo)}`)
                            .join(' / ')}`
                        : formatNaira(item.priceKobo)}
                    </span>
                    <span className="text-sm font-normal text-[var(--text-body-muted)]">
                      &bull; {item.portionLabel || 'Serves 1'} &bull; v{item.version}
                    </span>
                    {item.optionGroups && item.optionGroups.length > 0 && (
                      <span className="text-sm font-normal text-[var(--text-accent)]">
                        &bull; {item.optionGroups.length} option group(s)
                      </span>
                    )}
                    {(item.photoUrl || item.imagePath) && (
                      <span className="text-sm font-normal text-[var(--status-success-text)]">
                        &bull; Photo set
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: One-handed Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {isOwnerOrDev && (
                    <div className="flex border border-[var(--border-card)] rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleReorder(item.id, 'up')}
                        aria-label={`Move ${item.name} up`}
                        title="Move Up"
                        className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)]"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReorder(item.id, 'down')}
                        aria-label={`Move ${item.name} down`}
                        title="Move Down"
                        className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-[var(--bg-surface-muted)] text-[var(--text-primary)] border-l border-[var(--border-card)]"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleSoldOut(item)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold transition-all border ${
                      isSoldOut
                        ? 'bg-[#B3261E] text-white border-[#B3261E]'
                        : 'bg-[var(--bg-surface-muted)] border-[var(--border-card)] text-[var(--text-primary)] hover:border-[var(--border-gold)]'
                    }`}
                  >
                    {isSoldOut ? 'Sold Out' : 'Mark Sold Out'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleAvailability(item)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold border ${
                      item.isAvailable
                        ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                        : 'bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)]'
                    }`}
                  >
                    {item.isAvailable ? 'Available' : 'Unavailable'}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    disabled={!isOwnerOrDev}
                    aria-label={isOwnerOrDev ? `Edit ${item.name}` : 'Edit Dish (Owner only)'}
                    className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--border-card)] ${
                      isOwnerOrDev
                        ? 'text-[var(--text-primary)] hover:border-[var(--border-gold)] hover:text-[var(--text-accent)]'
                        : 'text-[var(--text-body-muted)] opacity-45 cursor-not-allowed'
                    }`}
                    title={isOwnerOrDev ? 'Edit Dish' : 'Owner only'}
                  >
                    {isOwnerOrDev ? <Edit2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>

                  {isOwnerOrDev && (
                    <button
                      type="button"
                      onClick={() => openVersionHistory(item)}
                      aria-label={`Version history for ${item.name}`}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--border-card)] text-[var(--text-primary)] hover:border-[var(--border-gold)] hover:text-[var(--text-accent)]"
                      title="Version History & Restore"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  )}

                  {isOwnerOrDev && item.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => handleArchive(item)}
                      aria-label={`Archive ${item.name}`}
                      className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] hover:opacity-90"
                      title="Archive Dish"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit / New Item Modal */}
      {(editingItem || isNewItem) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-item-modal-title"
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto text-[var(--text-primary)]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--border-subtle-card)]">
              <h2 id="menu-item-modal-title" className="text-lg font-serif font-bold text-[var(--text-primary)]">
                {isNewItem ? 'Add New Dish' : `Edit ${editingItem?.name}`}
              </h2>
              <button
                type="button"
                aria-label="Close dish dialog"
                onClick={() => {
                  setEditingItem(null);
                  setIsNewItem(false);
                }}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-[var(--text-body-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div>
                <label htmlFor="menu-dish-name" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                  Dish Name
                </label>
                <input
                  id="menu-dish-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="menu-dish-category" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Category
                  </label>
                  <select
                    id="menu-dish-category"
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="menu-dish-pricing-mode" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Pricing Structure
                  </label>
                  <select
                    id="menu-dish-pricing-mode"
                    value={formPricingMode}
                    onChange={(e) => {
                      const nextMode = e.target.value as 'single' | 'tiers';
                      setFormPricingMode(nextMode);
                      if (nextMode === 'tiers' && formTiers.length === 0) {
                        setFormTiers([
                          { id: '', label: 'S', priceNaira: '1500.00', active: true },
                          { id: '', label: 'M', priceNaira: '2500.00', active: true },
                        ]);
                      }
                    }}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                  >
                    <option value="single">Single Base Price</option>
                    <option value="tiers">Size Tiers (S / M / L — Base ₦0)</option>
                  </select>
                </div>
              </div>

              {formPricingMode === 'single' ? (
                <div>
                  <label htmlFor="menu-dish-price" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Base Price in ₦ (Saved in kobo)
                  </label>
                  <input
                    id="menu-dish-price"
                    type="text"
                    required
                    placeholder="e.g. 3,500.00"
                    value={formPriceNaira}
                    onChange={(e) => setFormPriceNaira(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm font-mono price-tabular text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                  />
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                      <span className="text-sm font-bold text-[var(--text-primary)]">
                        Size Tiers (Mutually Exclusive with Base Price)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFormTiers((prev) => [
                          ...prev,
                          { id: '', label: '', priceNaira: '2000.00', active: true },
                        ])
                      }
                      className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-gold)] text-sm font-semibold text-[var(--text-accent)] inline-flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Tier
                    </button>
                  </div>

                  {formTiers.map((tier, tIdx) => (
                    <div key={tIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[var(--bg-card)] p-2.5 rounded-lg border border-[var(--border-subtle-card)]">
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          aria-label={`Tier ${tIdx + 1} label`}
                          placeholder="Label (S / M / L)"
                          value={tier.label}
                          onChange={(e) =>
                            setFormTiers((prev) =>
                              prev.map((row, i) => (i === tIdx ? { ...row, label: e.target.value } : row))
                            )
                          }
                          className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          aria-label={`Tier ${tIdx + 1} price Naira`}
                          placeholder="Price ₦"
                          value={tier.priceNaira}
                          onChange={(e) =>
                            setFormTiers((prev) =>
                              prev.map((row, i) =>
                                i === tIdx ? { ...row, priceNaira: e.target.value } : row
                              )
                            )
                          }
                          className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 py-1.5 text-sm font-mono price-tabular text-[var(--text-primary)]"
                        />
                      </div>
                      <label className="sm:col-span-2 flex items-center gap-1.5 cursor-pointer min-h-[44px]">
                        <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                          <input
                            type="checkbox"
                            aria-label={`Tier ${tIdx + 1} active`}
                            checked={tier.active}
                            onChange={(e) =>
                              setFormTiers((prev) =>
                                prev.map((row, i) =>
                                  i === tIdx ? { ...row, active: e.target.checked } : row
                                )
                              )
                            }
                            className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37]"
                          />
                          <Check className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100" />
                        </div>
                        <span className="text-sm">Active</span>
                      </label>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          aria-label={`Remove tier ${tIdx + 1}`}
                          onClick={() =>
                            setFormTiers((prev) => prev.filter((_, i) => i !== tIdx))
                          }
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor="menu-dish-desc" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                  Description
                </label>
                <textarea
                  id="menu-dish-desc"
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="menu-dish-portion" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Portion Label
                  </label>
                  <input
                    id="menu-dish-portion"
                    type="text"
                    value={formPortion}
                    onChange={(e) => setFormPortion(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                  />
                </div>

                <div>
                  <label htmlFor="menu-dish-status" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Status
                  </label>
                  <select
                    id="menu-dish-status"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'draft' | 'published')}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                  >
                    <option value="draft">Draft (Hidden)</option>
                    <option value="published">Published (Visible)</option>
                  </select>
                </div>
              </div>

              {/* Dish Photo Manager */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      Dish Photo Manager
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={dishPhotoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleDishPhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => dishPhotoInputRef.current?.click()}
                      className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-gold)] text-sm font-semibold text-[var(--text-accent)] inline-flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" /> Upload Photo
                    </button>
                    {formPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormPhotoUrl('')}
                        className="min-h-[44px] px-3 rounded-lg bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-sm font-semibold text-[var(--status-danger-text)]"
                      >
                        Clear Photo
                      </button>
                    )}
                  </div>
                </div>

                {formPhotoUrl && (
                  <div className="w-full h-32 rounded-lg overflow-hidden border border-[var(--border-card)] bg-[var(--bg-primary)]">
                    <img
                      src={formPhotoUrl}
                      alt={formImageAlt || formName || 'Dish preview'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="menu-dish-photo-url" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                      Photo URL or Path
                    </label>
                    <input
                      id="menu-dish-photo-url"
                      type="text"
                      placeholder="/assets/dish.jpg or https://..."
                      value={formPhotoUrl}
                      onChange={(e) => setFormPhotoUrl(e.target.value)}
                      className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label htmlFor="menu-dish-photo-alt" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                      Photo Alt Text (Accessibility)
                    </label>
                    <input
                      id="menu-dish-photo-alt"
                      type="text"
                      placeholder="Describe the plated dish"
                      value={formImageAlt}
                      onChange={(e) => setFormImageAlt(e.target.value)}
                      className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* Option Groups Editor */}
              <div className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ListPlus className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      Option Groups &amp; Add-ons ({formOptionGroups.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormOptionGroups((prev) => [
                        ...prev,
                        {
                          id: '',
                          name: 'Choose Add-on',
                          minSelect: 0,
                          maxSelect: 1,
                          options: [
                            { id: '', name: 'Extra Protein', priceDeltaNaira: '1000.00', isAvailable: true },
                          ],
                        },
                      ])
                    }
                    className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-gold)] text-sm font-semibold text-[var(--text-accent)] inline-flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Option Group
                  </button>
                </div>

                {formOptionGroups.map((grp, gIdx) => (
                  <div
                    key={gIdx}
                    className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle-card)] space-y-2.5"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-6">
                        <input
                          type="text"
                          aria-label={`Option group ${gIdx + 1} title`}
                          placeholder="Group Title (e.g. Choose Protein)"
                          value={grp.name}
                          onChange={(e) =>
                            setFormOptionGroups((prev) =>
                              prev.map((row, i) =>
                                i === gIdx ? { ...row, name: e.target.value } : row
                              )
                            )
                          }
                          className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 text-sm text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min={0}
                          aria-label={`Option group ${gIdx + 1} min select`}
                          value={grp.minSelect}
                          onChange={(e) =>
                            setFormOptionGroups((prev) =>
                              prev.map((row, i) =>
                                i === gIdx ? { ...row, minSelect: Number(e.target.value) || 0 } : row
                              )
                            )
                          }
                          className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 text-sm font-mono price-tabular text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min={1}
                          aria-label={`Option group ${gIdx + 1} max select`}
                          value={grp.maxSelect}
                          onChange={(e) =>
                            setFormOptionGroups((prev) =>
                              prev.map((row, i) =>
                                i === gIdx ? { ...row, maxSelect: Number(e.target.value) || 1 } : row
                              )
                            )
                          }
                          className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 text-sm font-mono price-tabular text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          aria-label={`Remove option group ${gIdx + 1}`}
                          onClick={() =>
                            setFormOptionGroups((prev) => prev.filter((_, i) => i !== gIdx))
                          }
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {grp.options.map((opt, oIdx) => (
                      <div key={oIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pl-2">
                        <div className="sm:col-span-5">
                          <input
                            type="text"
                            aria-label={`Option ${oIdx + 1} name`}
                            placeholder="Option name"
                            value={opt.name}
                            onChange={(e) =>
                              setFormOptionGroups((prev) =>
                                prev.map((row, i) =>
                                  i === gIdx
                                    ? {
                                        ...row,
                                        options: row.options.map((op, j) =>
                                          j === oIdx ? { ...op, name: e.target.value } : op
                                        ),
                                      }
                                    : row
                                )
                              )
                            }
                            className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 text-sm text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <input
                            type="text"
                            aria-label={`Option ${oIdx + 1} delta ₦`}
                            placeholder="+₦ Delta"
                            value={opt.priceDeltaNaira}
                            onChange={(e) =>
                              setFormOptionGroups((prev) =>
                                prev.map((row, i) =>
                                  i === gIdx
                                    ? {
                                        ...row,
                                        options: row.options.map((op, j) =>
                                          j === oIdx
                                            ? { ...op, priceDeltaNaira: e.target.value }
                                            : op
                                        ),
                                      }
                                    : row
                                )
                              )
                            }
                            className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 text-sm font-mono price-tabular text-[var(--text-primary)]"
                          />
                        </div>
                        <label className="sm:col-span-2 flex items-center gap-1.5 cursor-pointer min-h-[44px]">
                          <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                            <input
                              type="checkbox"
                              aria-label={`Option ${oIdx + 1} available`}
                              checked={opt.isAvailable}
                              onChange={(e) =>
                                setFormOptionGroups((prev) =>
                                  prev.map((row, i) =>
                                    i === gIdx
                                      ? {
                                          ...row,
                                          options: row.options.map((op, j) =>
                                            j === oIdx
                                              ? { ...op, isAvailable: e.target.checked }
                                              : op
                                          ),
                                        }
                                      : row
                                  )
                                )
                              }
                              className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37]"
                            />
                            <Check className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100" />
                          </div>
                          <span className="text-sm">On</span>
                        </label>
                        <div className="sm:col-span-2 flex justify-end">
                          <button
                            type="button"
                            aria-label={`Remove option ${oIdx + 1}`}
                            onClick={() =>
                              setFormOptionGroups((prev) =>
                                prev.map((row, i) =>
                                  i === gIdx
                                    ? {
                                        ...row,
                                        options: row.options.filter((_, j) => j !== oIdx),
                                      }
                                    : row
                                )
                              )
                            }
                            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-[var(--border-card)] text-[var(--text-body-muted)]"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setFormOptionGroups((prev) =>
                          prev.map((row, i) =>
                            i === gIdx
                              ? {
                                  ...row,
                                  options: [
                                    ...row.options,
                                    { id: '', name: '', priceDeltaNaira: '0.00', isAvailable: true },
                                  ],
                                }
                              : row
                          )
                        )
                      }
                      className="min-h-[44px] px-3 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-sm font-semibold text-[var(--text-accent)] inline-flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Option Choice
                    </button>
                  </div>
                ))}
              </div>

              {/* Availability Note, Allergens, and Kitchen Heat Display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="menu-dish-availability-note" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Availability Schedule Note
                  </label>
                  <input
                    id="menu-dish-availability-note"
                    type="text"
                    placeholder="e.g. Wednesday & Friday only"
                    value={formAvailabilityNote}
                    onChange={(e) => setFormAvailabilityNote(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label htmlFor="menu-dish-allergens" className="block text-sm font-semibold text-[var(--text-accent)] mb-1">
                    Allergens (comma-separated)
                  </label>
                  <input
                    id="menu-dish-allergens"
                    type="text"
                    placeholder="e.g. fish, shellfish, nuts"
                    value={formAllergensCsv}
                    onChange={(e) => setFormAllergensCsv(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-2.5 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
                <label
                  htmlFor="featuredToggle"
                  className="flex items-center gap-3 cursor-pointer min-h-[44px]"
                >
                  <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                    <input
                      type="checkbox"
                      id="featuredToggle"
                      checked={formFeatured}
                      onChange={(e) => setFormFeatured(e.target.checked)}
                      className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer"
                    />
                    <Check
                      aria-hidden="true"
                      className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                    />
                  </div>
                  <span className="text-sm text-[var(--text-primary)] font-medium">
                    Feature on homepage
                  </span>
                </label>

                <label
                  htmlFor="showHeatToggle"
                  className="flex items-center gap-3 cursor-pointer min-h-[44px]"
                >
                  <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                    <input
                      type="checkbox"
                      id="showHeatToggle"
                      checked={formShowHeat}
                      onChange={(e) => setFormShowHeat(e.target.checked)}
                      className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer"
                    />
                    <Check
                      aria-hidden="true"
                      className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                    />
                  </div>
                  <span className="text-sm text-[var(--text-primary)] font-medium">
                    Served hot (steam badge)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle-card)]">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setIsNewItem(false);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-sm border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-luxury text-sm font-bold">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price Change Confirmation Dialog (Mandatory Playbook Section 7.A) */}
      {priceChangeConfirmation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="price-change-confirm-title"
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl max-w-md w-full p-6 text-center text-[var(--text-primary)]">
            <AlertTriangle className="w-10 h-10 text-[var(--text-accent)] mx-auto mb-3" />
            <h3 id="price-change-confirm-title" className="text-lg font-serif font-bold text-[var(--text-primary)] mb-2">
              Confirm Price Change
            </h3>
            <p className="text-sm text-[var(--text-primary)] mb-4 font-mono price-tabular bg-[var(--bg-surface-muted)] p-3.5 rounded-xl border border-[var(--border-subtle-card)]">
              {priceChangeConfirmation.item.name}: {formatNaira(priceChangeConfirmation.oldPriceKobo)} to{' '}
              <span className="text-[var(--text-accent)] font-bold">
                {formatNaira(priceChangeConfirmation.newPriceKobo)}
              </span>
              .
              <span className="block text-sm text-[var(--text-body-muted)] font-sans mt-2">
                Applies to new orders only. Past orders keep their immutable snapshot.
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPriceChangeConfirmation(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => commitItemSave(priceChangeConfirmation.newPriceKobo)}
                className="btn-luxury text-sm font-bold"
              >
                Confirm Price Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal with 1-Tap Restore */}
      {versionHistoryItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="version-history-modal-title"
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto text-[var(--text-primary)]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--border-subtle-card)]">
              <h3 id="version-history-modal-title" className="text-lg font-serif font-bold text-[var(--text-primary)]">
                Version History: {versionHistoryItem.name}
              </h3>
              <button
                type="button"
                aria-label="Close version history modal"
                onClick={() => setVersionHistoryItem(null)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-[var(--text-body-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {versionsList.length === 0 ? (
              <p className="text-sm text-[var(--text-body-muted)]">
                No earlier versions saved for this dish yet.
              </p>
            ) : (
              <div className="space-y-3">
                {versionsList.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3.5 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <div className="font-bold text-[var(--text-accent)]">Version {ver.version}</div>
                      <div className="text-[var(--text-primary)] font-medium price-tabular">
                        {ver.snapshot.name} &bull; {formatNaira(ver.snapshot.priceKobo)} &bull; {ver.snapshot.status}
                      </div>
                      <div className="text-sm text-[var(--text-body-muted)]">
                        Saved on {new Date(ver.changedAt).toLocaleString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestoreVersion(ver.version)}
                      className="min-h-[44px] bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50 px-3.5 py-2 rounded-xl font-semibold text-sm hover:bg-[#82173B] shrink-0"
                    >
                      1-Tap Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Modal with Mandatory Dry-Run */}
      {showCsvModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="csv-import-modal-title"
          className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto text-[var(--text-primary)]">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--border-subtle-card)]">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[var(--text-accent)]" />
                <h3 id="csv-import-modal-title" className="text-lg font-serif font-bold text-[var(--text-primary)]">
                  Import Menu CSV (Mandatory Dry-Run)
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close CSV import modal"
                onClick={() => setShowCsvModal(false)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-[var(--text-body-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label htmlFor="menu-csv-textarea" className="block text-sm text-[var(--text-body-muted)] mb-3">
              Paste CSV contents below. The dry-run will validate all prices in kobo, check duplicate names, and list
              exact rows to create or update before anything touches the database.
            </label>

            <textarea
              id="menu-csv-textarea"
              rows={6}
              value={rawCsvInput}
              onChange={(e) => setRawCsvInput(e.target.value)}
              placeholder="sku,category,name,description,price_ngn,portion_label,allergens,status,available,featured,sort_order"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl p-3 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)] mb-3"
            />

            {csvError && (
              <div
                role="alert"
                className="p-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-sm rounded-xl mb-3"
              >
                {csvError}
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <button
                type="button"
                onClick={handleDryRunCsv}
                className="btn-luxury text-sm font-semibold"
              >
                Run Validation Dry-Run
              </button>
            </div>

            {/* Dry Run Report */}
            {dryRunReport && (
              <div className="bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] rounded-xl p-4 text-sm space-y-3 mb-4">
                <div className="font-bold text-[var(--text-accent)] border-b border-[var(--border-subtle-card)] pb-2 flex justify-between">
                  <span>Dry-Run Result Summary</span>
                  <span className="price-tabular">{dryRunReport.totalRows} Data Rows</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center py-2">
                  <div className="p-2.5 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-lg">
                    <span className="block font-bold text-[var(--status-success-text)] text-base price-tabular">
                      {dryRunReport.rowsToCreate.length}
                    </span>
                    <span className="text-sm text-[var(--status-success-text)]">To Create</span>
                  </div>
                  <div className="p-2.5 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-lg">
                    <span className="block font-bold text-[var(--status-warning-text)] text-base price-tabular">
                      {dryRunReport.rowsToUpdate.length}
                    </span>
                    <span className="text-sm text-[var(--status-warning-text)]">To Update</span>
                  </div>
                  <div className="p-2.5 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-lg">
                    <span className="block font-bold text-[var(--status-danger-text)] text-base price-tabular">
                      {dryRunReport.rowsRejected.length}
                    </span>
                    <span className="text-sm text-[var(--status-danger-text)]">Rejected</span>
                  </div>
                </div>

                {dryRunReport.rowsRejected.length > 0 && (
                  <div className="bg-[var(--status-danger-bg)] p-3 rounded-xl border border-[var(--status-danger-border)] text-[var(--status-danger-text)]">
                    <span className="font-bold block mb-1">Validation Errors (Must be fixed):</span>
                    <ul className="list-disc pl-4 space-y-1">
                      {dryRunReport.rowsRejected.map((r, i) => (
                        <li key={i}>
                          Row {r.rowNumber}: {r.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dryRunReport.rowsToUpdate.length > 0 && (
                  <div className="text-[var(--text-primary)] space-y-1">
                    <span className="font-semibold text-[var(--text-accent)] block">Price Updates Detected:</span>
                    {dryRunReport.rowsToUpdate.map((u, i) => (
                      <div key={i} className="flex justify-between gap-2 border-b border-[var(--border-subtle-card)] py-1.5">
                        <span>{u.name} ({u.sku})</span>
                        <span className="price-tabular font-mono">
                          {formatNaira(u.oldPriceKobo)} &rarr;{' '}
                          <strong className="text-[var(--text-accent)]">{formatNaira(u.newPriceKobo)}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {dryRunReport.isIdempotent && (
                  <div className="p-2.5 bg-[var(--status-info-bg)] border border-[var(--status-info-border)] text-[var(--status-info-text)] rounded-lg text-sm">
                    Identical content detected: re-importing this file will make 0 changes (Idempotent).
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={dryRunReport.rowsRejected.length > 0}
                    onClick={handleCommitCsv}
                    className={`btn-luxury text-sm font-bold ${
                      dryRunReport.rowsRejected.length > 0 ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    Confirm &amp; Commit Import ({dryRunReport.rowsToCreate.length + dryRunReport.rowsToUpdate.length} Rows)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Founder Photo Management Modal */}
      {showFounderModal && (
        <FounderPhotoModal onClose={() => setShowFounderModal(false)} />
      )}
    </div>
  );
};
