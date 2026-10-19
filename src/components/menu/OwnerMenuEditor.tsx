/**
 * ROCK UC FOODS - Mobile-First Owner Menu Editor
 * (Playbook v2 Section 7.A & Decision 2)
 * Usable one-handed on mobile devices.
 * Staff can only toggle availability; Owner manages prices, edits, versions, and CSV.
 */

import React, { useState } from 'react';
import { menuRepository } from '../../menu/data';
import { formatNaira, parseNairaToKobo } from '../../lib/money';
import { MenuItem, MenuCategory, MenuItemVersionRecord } from '../../types/menu';
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
} from 'lucide-react';
import { FounderPhotoModal } from '../brand/FounderPhoto';

interface OwnerMenuEditorProps {
  currentUserRole: 'owner' | 'staff' | 'developer';
  currentUserId: string;
}

export const OwnerMenuEditor: React.FC<OwnerMenuEditorProps> = ({
  currentUserRole,
  currentUserId,
}) => {
  const isOwnerOrDev = currentUserRole === 'owner' || currentUserRole === 'developer';

  const [refreshTrigger, setRefreshTrigger] = useState(0);
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

  // Filter items
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

  // Toggle Sold Out Today (Staff & Owner permitted)
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

  // Toggle Availability (Staff & Owner permitted)
  const handleToggleAvailability = (item: MenuItem) => {
    try {
      menuRepository.toggleAvailability(item.id, currentUserId, currentUserRole);
      notify(`Updated ${item.name}: ${item.isAvailable ? 'Available' : 'Unavailable'}`);
      handleRefresh();
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  // Reorder Item (Up/Down)
  const handleReorder = (itemId: string, direction: 'up' | 'down') => {
    if (!isOwnerOrDev) {
      notify('Reordering menu items requires owner role.', 'error');
      return;
    }
    menuRepository.reorderItem(itemId, direction);
    handleRefresh();
  };

  // Open Edit Form
  const openEditModal = (item: MenuItem) => {
    if (!isOwnerOrDev) {
      notify('Staff accounts can only toggle daily availability and sold out status.', 'error');
      return;
    }
    setEditingItem(item);
    setIsNewItem(false);
    setFormName(item.name);
    setFormCategoryId(item.categoryId);
    setFormPriceNaira((Number(item.priceKobo) / 100).toFixed(2));
    setFormDescription(item.description || '');
    setFormPortion(item.portionLabel || 'Serves 1');
    setFormStatus(item.status === 'archived' ? 'draft' : item.status);
    setFormFeatured(item.isFeatured);
  };

  // Open New Item Form
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
  };

  // Submit Item Form
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOrDev) return;

    try {
      const parsedKobo = parseNairaToKobo(formPriceNaira);

      // Check if price changed on existing item -> trigger confirmation dialog
      if (editingItem && editingItem.priceKobo !== parsedKobo) {
        setPriceChangeConfirmation({
          item: editingItem,
          oldPriceKobo: editingItem.priceKobo,
          newPriceKobo: parsedKobo,
        });
        return;
      }

      commitItemSave(parsedKobo);
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const commitItemSave = (priceKobo: bigint) => {
    try {
      menuRepository.saveItem(
        {
          id: editingItem?.id,
          categoryId: formCategoryId,
          name: formName,
          description: formDescription,
          priceKobo,
          portionLabel: formPortion,
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

  // View Version History
  const openVersionHistory = (item: MenuItem) => {
    setVersionHistoryItem(item);
    const history = menuRepository.getVersionsForItem(item.id);
    setVersionsList(history);
  };

  // Restore Version
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

  // Archive Item
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

  // CSV Dry Run
  const handleDryRunCsv = () => {
    try {
      setCsvError(null);
      const res = dryRunMenuCsv(rawCsvInput);
      setDryRunReport(res);
    } catch (err: unknown) {
      setCsvError((err as Error).message);
    }
  };

  // Commit CSV Import
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

  // Export CSV
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
    <div className="bg-[#0B0A09] text-[#F7EFD9] min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      {/* Top Banner & Notifications */}
      {notification && (
        <div
          className={`p-3 rounded mb-4 text-xs md:text-sm font-semibold flex items-center gap-2 ${
            notification.type === 'error'
              ? 'bg-[#B3261E] text-white'
              : 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[#F7EFD9]">Menu Management</h1>
            <span
              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                isOwnerOrDev
                  ? 'bg-[#D4AF37] text-[#0B0A09]'
                  : 'bg-white/10 text-[#F7EFD9]/70 border border-white/10'
              }`}
            >
              Role: {currentUserRole}
            </span>
          </div>
          <p className="text-xs text-[#F7EFD9]/60 mt-1">
            {isOwnerOrDev
              ? 'Full catalog control: prices, portions, versions & dry-run CSV imports.'
              : 'Staff view: Toggle availability and sold-out status only.'}
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {isOwnerOrDev && (
            <button
              onClick={openNewItemModal}
              className="btn-luxury text-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Add Dish
            </button>
          )}
          {isOwnerOrDev && (
            <button
              onClick={() => setShowCsvModal(true)}
              className="bg-[#17120F] border border-[#D4AF37]/40 text-[#F7EFD9] px-3 py-2 rounded text-xs font-semibold hover:border-[#D4AF37] flex items-center gap-1 shrink-0"
            >
              <Upload className="w-3.5 h-3.5 text-[#D4AF37]" /> Import CSV
            </button>
          )}
          {isOwnerOrDev && (
            <button
              onClick={() => setShowFounderModal(true)}
              className="bg-[#17120F] border border-[#D4AF37]/40 text-[#F7EFD9] px-3 py-2 rounded text-xs font-semibold hover:border-[#D4AF37] flex items-center gap-1 shrink-0"
            >
              <Camera className="w-3.5 h-3.5 text-[#D4AF37]" /> Founder Photo
            </button>
          )}
          <button
            onClick={handleExportCsv}
            className="bg-[#17120F] border border-white/10 text-[#F7EFD9] px-3 py-2 rounded text-xs font-semibold hover:border-white/30 flex items-center gap-1 shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by dish name or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-[#17120F] border border-white/10 rounded px-3 py-2 text-xs md:text-sm text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37] flex-1"
        />

        <div className="flex gap-1 overflow-x-auto pb-1">
          {['all', 'published', 'draft', 'sold_out', 'archived'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider shrink-0 ${
                filterStatus === status
                  ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/30'
                  : 'bg-[#17120F] text-[#F7EFD9]/60 hover:text-[#F7EFD9]'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Item List Cards */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-[#17120F] rounded p-8 text-center border border-white/5">
            <p className="text-sm text-[#F7EFD9]/60">No dishes match the selected filter.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSoldOut = menuRepository.isItemSoldOutToday(item);
            const catName = categories.find((c) => c.id === item.categoryId)?.name || 'Unassigned';

            return (
              <div
                key={item.id}
                className="bg-[#17120F] border border-[#D4AF37]/20 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
              >
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[11px] font-mono text-[#D4AF37]/80">{item.sku}</span>
                    <span className="text-[11px] bg-white/5 px-2 py-0.5 rounded text-[#F7EFD9]/70">
                      {catName}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        item.status === 'published'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : item.status === 'draft'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.isFeatured && (
                      <span className="bg-[#F2C230] text-[#0B0A09] text-[10px] font-bold px-1.5 py-0.2 rounded">
                        Featured
                      </span>
                    )}
                    {isSoldOut && (
                      <span className="bg-[#B3261E] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        Sold out today
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-serif font-bold text-[#F7EFD9] truncate">
                    {item.name}
                  </h3>
                  <div className="text-sm font-bold text-[#D4AF37] price-tabular mt-0.5">
                    {formatNaira(item.priceKobo)}{' '}
                    <span className="text-xs font-normal text-[#F7EFD9]/50">
                      &bull; {item.portionLabel || 'Serves 1'} &bull; v{item.version}
                    </span>
                  </div>
                </div>

                {/* Right: One-handed Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {/* Reorder Up/Down */}
                  {isOwnerOrDev && (
                    <div className="flex border border-white/10 rounded">
                      <button
                        onClick={() => handleReorder(item.id, 'up')}
                        title="Move Up"
                        className="p-2 hover:bg-white/5 text-[#F7EFD9]/70 hover:text-[#D4AF37]"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleReorder(item.id, 'down')}
                        title="Move Down"
                        className="p-2 hover:bg-white/5 text-[#F7EFD9]/70 hover:text-[#D4AF37] border-l border-white/10"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* One-tap Sold Out Today Toggle */}
                  <button
                    onClick={() => handleToggleSoldOut(item)}
                    className={`px-3 py-2 rounded text-xs font-semibold transition-all ${
                      isSoldOut
                        ? 'bg-[#B3261E] text-white'
                        : 'bg-[#17120F] border border-white/10 text-[#F7EFD9]/80 hover:border-[#D4AF37]'
                    }`}
                  >
                    {isSoldOut ? 'Sold Out' : 'Mark Sold Out'}
                  </button>

                  {/* One-tap Available Toggle */}
                  <button
                    onClick={() => handleToggleAvailability(item)}
                    className={`px-3 py-2 rounded text-xs font-semibold ${
                      item.isAvailable
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {item.isAvailable ? 'Available' : 'Unavailable'}
                  </button>

                  {/* Edit Button (Owner only) */}
                  <button
                    onClick={() => openEditModal(item)}
                    disabled={!isOwnerOrDev}
                    className={`p-2 rounded border border-white/10 ${
                      isOwnerOrDev
                        ? 'text-[#F7EFD9] hover:border-[#D4AF37] hover:text-[#D4AF37]'
                        : 'text-white/20 cursor-not-allowed'
                    }`}
                    title={isOwnerOrDev ? 'Edit Dish' : 'Owner only'}
                  >
                    {isOwnerOrDev ? <Edit2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>

                  {/* Version History (Owner only) */}
                  {isOwnerOrDev && (
                    <button
                      onClick={() => openVersionHistory(item)}
                      className="p-2 rounded border border-white/10 text-[#F7EFD9] hover:border-[#D4AF37] hover:text-[#D4AF37]"
                      title="Version History & Restore"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  )}

                  {/* Archive (Owner only) */}
                  {isOwnerOrDev && item.status !== 'archived' && (
                    <button
                      onClick={() => handleArchive(item)}
                      className="p-2 rounded border border-white/10 text-rose-400 hover:border-rose-500"
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#17120F] border border-[#D4AF37]/50 rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <h2 className="text-lg font-serif font-bold text-[#F7EFD9]">
                {isNewItem ? 'Add New Dish' : `Edit ${editingItem?.name}`}
              </h2>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsNewItem(false);
                }}
                className="text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#D4AF37] mb-1">Dish Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#0B0A09] border border-white/10 rounded p-2.5 text-sm text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#D4AF37] mb-1">Category</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full bg-[#0B0A09] border border-white/10 rounded p-2.5 text-sm text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4AF37] mb-1">
                    Price in ₦ (Converted to kobo on server)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3,500.00"
                    value={formPriceNaira}
                    onChange={(e) => setFormPriceNaira(e.target.value)}
                    className="w-full bg-[#0B0A09] border border-white/10 rounded p-2.5 text-sm text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D4AF37] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#0B0A09] border border-white/10 rounded p-2.5 text-sm text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#D4AF37] mb-1">Portion Label</label>
                  <input
                    type="text"
                    value={formPortion}
                    onChange={(e) => setFormPortion(e.target.value)}
                    className="w-full bg-[#0B0A09] border border-white/10 rounded p-2.5 text-sm text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#D4AF37] mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'draft' | 'published')}
                    className="w-full bg-[#0B0A09] border border-white/10 rounded p-2.5 text-sm text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="draft">Draft (Hidden)</option>
                    <option value="published">Published (Visible)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="featuredToggle"
                  checked={formFeatured}
                  onChange={(e) => setFormFeatured(e.target.checked)}
                  className="accent-[#6B1230] w-4 h-4"
                />
                <label htmlFor="featuredToggle" className="text-xs text-[#F7EFD9]">
                  Feature this dish on homepage
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null);
                    setIsNewItem(false);
                  }}
                  className="px-4 py-2 rounded text-xs border border-white/10 text-white/70 hover:text-white"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-luxury text-xs font-bold">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price Change Confirmation Dialog (Mandatory Playbook Section 7.A) */}
      {priceChangeConfirmation && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#17120F] border border-[#D4AF37] rounded-lg max-w-md w-full p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-[#D4AF37] mx-auto mb-3" />
            <h3 className="text-lg font-serif font-bold text-[#F7EFD9] mb-2">Confirm Price Change</h3>
            <p className="text-sm text-[#F7EFD9]/90 mb-4 font-mono bg-[#0B0A09] p-3 rounded border border-white/10">
              {priceChangeConfirmation.item.name}: {formatNaira(priceChangeConfirmation.oldPriceKobo)} to{' '}
              <span className="text-[#D4AF37] font-bold">{formatNaira(priceChangeConfirmation.newPriceKobo)}</span>.
              <span className="block text-xs text-[#F7EFD9]/60 font-sans mt-2">
                Applies to new orders only. Past orders keep their immutable snapshot.
              </span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPriceChangeConfirmation(null)}
                className="px-4 py-2 rounded text-xs border border-white/10 text-white/70"
              >
                Cancel
              </button>
              <button
                onClick={() => commitItemSave(priceChangeConfirmation.newPriceKobo)}
                className="btn-luxury text-xs font-bold"
              >
                Confirm Price Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal with 1-Tap Restore */}
      {versionHistoryItem && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#17120F] border border-[#D4AF37]/50 rounded-lg max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <h3 className="text-lg font-serif font-bold text-[#F7EFD9]">
                Version History: {versionHistoryItem.name}
              </h3>
              <button onClick={() => setVersionHistoryItem(null)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {versionsList.length === 0 ? (
              <p className="text-xs text-[#F7EFD9]/60">No earlier versions saved for this dish yet.</p>
            ) : (
              <div className="space-y-3">
                {versionsList.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3 bg-[#0B0A09] border border-white/10 rounded flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#D4AF37]">Version {ver.version}</div>
                      <div className="text-[#F7EFD9]/80 font-medium">
                        {ver.snapshot.name} &bull; {formatNaira(ver.snapshot.priceKobo)} &bull; {ver.snapshot.status}
                      </div>
                      <div className="text-[10px] text-[#F7EFD9]/50">
                        Saved on {new Date(ver.changedAt).toLocaleString()}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRestoreVersion(ver.version)}
                      className="bg-[#6B1230] text-[#F7EFD9] px-3 py-1.5 rounded font-semibold text-xs hover:bg-[#82173B] shrink-0"
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
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#17120F] border border-[#D4AF37] rounded-lg max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-lg font-serif font-bold text-[#F7EFD9]">
                  Import Menu CSV (Mandatory Dry-Run)
                </h3>
              </div>
              <button onClick={() => setShowCsvModal(false)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#F7EFD9]/70 mb-3">
              Paste CSV contents below. The dry-run will validate all prices in kobo, check duplicate names, and list
              exact rows to create or update before anything touches the database.
            </p>

            <textarea
              rows={6}
              value={rawCsvInput}
              onChange={(e) => setRawCsvInput(e.target.value)}
              placeholder="sku,category,name,description,price_ngn,portion_label,allergens,status,available,featured,sort_order"
              className="w-full bg-[#0B0A09] border border-white/10 rounded p-3 text-xs font-mono text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37] mb-3"
            />

            {csvError && (
              <div className="p-3 bg-[#B3261E] text-white text-xs rounded mb-3">
                {csvError}
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <button
                onClick={handleDryRunCsv}
                className="btn-luxury text-xs font-semibold"
              >
                Run Validation Dry-Run
              </button>
            </div>

            {/* Dry Run Report */}
            {dryRunReport && (
              <div className="bg-[#0B0A09] border border-white/10 rounded p-4 text-xs space-y-3 mb-4">
                <div className="font-bold text-[#D4AF37] border-b border-white/10 pb-1 flex justify-between">
                  <span>Dry-Run Result Summary</span>
                  <span>{dryRunReport.totalRows} Data Rows</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center py-2">
                  <div className="p-2 bg-emerald-950/40 border border-emerald-800 rounded">
                    <span className="block font-bold text-emerald-400 text-sm">
                      {dryRunReport.rowsToCreate.length}
                    </span>
                    <span className="text-[10px] text-emerald-300">To Create</span>
                  </div>
                  <div className="p-2 bg-amber-950/40 border border-amber-800 rounded">
                    <span className="block font-bold text-amber-400 text-sm">
                      {dryRunReport.rowsToUpdate.length}
                    </span>
                    <span className="text-[10px] text-amber-300">To Update</span>
                  </div>
                  <div className="p-2 bg-rose-950/40 border border-rose-800 rounded">
                    <span className="block font-bold text-rose-400 text-sm">
                      {dryRunReport.rowsRejected.length}
                    </span>
                    <span className="text-[10px] text-rose-300">Rejected</span>
                  </div>
                </div>

                {dryRunReport.rowsRejected.length > 0 && (
                  <div className="bg-rose-950/60 p-3 rounded border border-rose-800 text-rose-200">
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
                  <div className="text-[#F7EFD9]/80 space-y-1">
                    <span className="font-semibold text-[#D4AF37] block">Price Updates Detected:</span>
                    {dryRunReport.rowsToUpdate.map((u, i) => (
                      <div key={i} className="flex justify-between border-b border-white/5 py-1">
                        <span>{u.name} ({u.sku})</span>
                        <span>
                          {formatNaira(u.oldPriceKobo)} &rarr;{' '}
                          <strong className="text-[#D4AF37]">{formatNaira(u.newPriceKobo)}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {dryRunReport.isIdempotent && (
                  <div className="p-2 bg-blue-950/40 border border-blue-800 text-blue-300 rounded text-[11px]">
                    Identical content detected: re-importing this file will make 0 changes (Idempotent).
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    disabled={dryRunReport.rowsRejected.length > 0}
                    onClick={handleCommitCsv}
                    className={`btn-luxury text-xs font-bold ${
                      dryRunReport.rowsRejected.length > 0
                        ? 'opacity-40 cursor-not-allowed'
                        : 'bg-[#6B1230] text-[#F7EFD9]'
                    }`}
                  >
                    Confirm & Commit Import ({dryRunReport.rowsToCreate.length + dryRunReport.rowsToUpdate.length} Rows)
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
