"use client";

import { useMemo, useState, useCallback } from "react";
import { ArrowLeft, Edit2, GripVertical, Plus, Save, Trash2, Upload, X, Image as ImageIcon, Globe, Calendar, ExternalLink, Sparkles, CheckCircle2, Info } from "lucide-react";
import { AdminInput, AdminSelect, ConfirmModal, StatusBadge, useToast, LoadingButton, DataTable, TableStatusAction, AdminBulkActionsBar } from "@/components/admin/AdminComponents";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { Modal } from "@/components/ui/Modal";
import MediaSelectorModal from "@/components/admin/media/MediaSelectorModal";
import { useAdminBanners, useAdminCountries, useBulkBanners, useCreateBanner, useDeleteBanner, useReorderBanners, useUpdateBanner } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";


type Banner = {
  id: string;
  title: string;
  image: string;
  mobileImage?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  placement: string;
  countryId?: string | null;
  country?: { code: string; name: string } | null;
  sortOrder: number;
  status: boolean;
  startDate?: string | null;
  endDate?: string | null;
};

const PLACEMENT_CONFIG: Record<
  string,
  {
    label: string;
    page: string;
    context: string;
    cardinality: "MULTIPLE" | "SINGLE";
    cardinalityLabel: string;
    badgeColor: string;
    description: string;
  }
> = {
  HOMEPAGE_HERO: {
    label: "Homepage Hero Carousel",
    page: "Homepage",
    context: "Hero Carousel Slider",
    cardinality: "MULTIPLE",
    cardinalityLabel: "Multi-Slide Carousel",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description:
      "Controls the rotating promotional hero carousel slider at the top of the Homepage. Supports multiple slides and drag-and-drop reordering.",
  },
  HOMEPAGE_PROMO: {
    label: "Homepage Body Promo",
    page: "Homepage",
    context: "Mid-Page Promo Banner",
    cardinality: "SINGLE",
    cardinalityLabel: "Single-Slot Static Banner",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    description:
      "Controls the single promotional banner displayed beside featured products in the Homepage body. Supports exactly one banner (no slider/ordering).",
  },
  ABOUT_HERO: {
    label: "About Us Hero Banner",
    page: "About Us",
    context: "About Page Top Visual",
    cardinality: "SINGLE",
    cardinalityLabel: "Single-Slot Header Visual",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    description:
      "Controls the single visual hero banner displayed at the top of the About Us page (/about). Supports exactly one banner.",
  },
};

const PAGE_GROUPS = [
  { id: "ALL", label: "All Banners", placements: [] },
  { id: "HOME", label: "Homepage", placements: ["HOMEPAGE_HERO", "HOMEPAGE_PROMO"] },
  { id: "ABOUT", label: "About Us", placements: ["ABOUT_HERO"] },
];

const PLACEMENT_OPTIONS = [
  { value: "HOMEPAGE_HERO", label: "Homepage — Hero Carousel Slider (Multi-Slide)" },
  { value: "HOMEPAGE_PROMO", label: "Homepage — Body Promo Banner (Single Slot)" },
  { value: "ABOUT_HERO", label: "About Us — Hero Banner Visual (Single Slot)" },
];

const empty = {
  id: "",
  title: "",
  image: "",
  mobileImage: "",
  linkUrl: "",
  linkText: "",
  showOverlay: false,
  kicker: "Modern Orthodontics",
  customTitle: "",
  placement: "HOMEPAGE_HERO",
  countryId: "",
  countryIds: [] as string[],
  status: true,
  startDate: "",
  endDate: "",
};

export default function BannersPage() {
  const [activeGroup, setActiveGroup] = useState("ALL");
  const [placement, setPlacement] = useState("");
  const [form, setForm] = useState(empty);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<string>("enable");
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"image" | "mobileImage" | null>(null);
  const [previewUrls, setPreviewUrls] = useState<{ image?: string; mobileImage?: string }>({});
  const [mediaSelector, setMediaSelector] = useState<{ open: boolean; field: "image" | "mobileImage" }>({
    open: false,
    field: "image",
  });


  const { showToast, ToastComponent } = useToast();
  const { data: allBannersData = [], isLoading } = useAdminBanners({});
  const { data: countries = [] } = useAdminCountries();

  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();
  const reorderBanners = useReorderBanners();
  const bulkBanners = useBulkBanners();

  const allBanners = (allBannersData ?? []) as Banner[];
  
  // Filter banners by page group and specific placement
  const banners = useMemo(() => {
    let list = (allBanners ?? []).slice();
    if (placement) {
      list = list.filter((b) => b.placement === placement);
    } else if (activeGroup !== "ALL") {
      const group = PAGE_GROUPS.find((g) => g.id === activeGroup);
      if (group && group.placements.length > 0) {
        list = list.filter((b) => group.placements.includes(b.placement));
      }
    }
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [allBanners, placement, activeGroup]);

  // Counts by placement and page group
  const counts = useMemo(() => {
    const placementMap: Record<string, number> = {};
    const groupMap: Record<string, number> = { ALL: allBanners.length };

    for (const b of allBanners) {
      placementMap[b.placement] = (placementMap[b.placement] || 0) + 1;
    }

    for (const g of PAGE_GROUPS) {
      if (g.id !== "ALL") {
        groupMap[g.id] = g.placements.reduce((sum, p) => sum + (placementMap[p] || 0), 0);
      }
    }

    return { placementMap, groupMap };
  }, [allBanners]);

  const handleSelectGroup = (groupId: string) => {
    setActiveGroup(groupId);
    setPlacement("");
    setSelected([]);
  };

  const handleSelectPlacement = (p: string) => {
    setPlacement(p);
    setSelected([]);
  };

  const currentGroup = PAGE_GROUPS.find((g) => g.id === activeGroup) || PAGE_GROUPS[0];

  // Selected placement context and cardinality
  const selectedPlacement = placement || (activeGroup !== "ALL" && currentGroup.placements.length === 1 ? currentGroup.placements[0] : "");
  const isSingleSlotActive = Boolean(selectedPlacement && PLACEMENT_CONFIG[selectedPlacement]?.cardinality === "SINGLE");
  const singleSlotBanner = isSingleSlotActive && banners.length > 0 ? banners[0] : null;

  // Track which single-slot placements are already configured
  const singleSlotTaken = useMemo(() => {
    const taken: Record<string, boolean> = {};
    for (const b of allBanners) {
      if (PLACEMENT_CONFIG[b.placement]?.cardinality === "SINGLE" && b.id !== form.id) {
        taken[b.placement] = true;
      }
    }
    return taken;
  }, [allBanners, form.id]);

  const availablePlacementOptions = useMemo(() => {
    if (form.id) return PLACEMENT_OPTIONS;
    return PLACEMENT_OPTIONS.filter((opt) => !singleSlotTaken[opt.value]);
  }, [singleSlotTaken, form.id]);

  const toggleStatus = useCallback(
    async (row: Banner) => {
      const selectedCountries = row.countryId ? [row.countryId] : [];
      const basePayload = {
        id: row.id,
        title: row.title,
        image: row.image,
        mobileImage: row.mobileImage || null,
        linkUrl: row.linkUrl || null,
        linkText: row.linkText || null,
        placement: row.placement,
        countryIds: selectedCountries,
        countryId: row.countryId || null,
        status: !row.status,
        startDate: row.startDate?.slice(0, 10) || null,
        endDate: row.endDate?.slice(0, 10) || null,
      };
      try {
        await updateBanner.mutateAsync(basePayload);
        showToast("Status updated.");
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to update status."), "error");
      }
    },
    [updateBanner, showToast]
  );

  const edit = useCallback((row: Banner) => {
    let showOverlay = false;
    let kicker = "Modern Orthodontics";
    let linkText = row.linkText ?? "";
    let customTitle = "";

    if (row.linkText && row.linkText.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(row.linkText);
        showOverlay = Boolean(parsed.showOverlay);
        kicker = parsed.kicker || "Modern Orthodontics";
        linkText = parsed.buttonText || "";
        customTitle = parsed.customTitle || "";
      } catch {
        // use plain string
      }
    }

    setForm({
      id: row.id,
      title: row.title,
      image: row.image,
      mobileImage: row.mobileImage ?? "",
      linkUrl: row.linkUrl ?? "",
      linkText,
      showOverlay,
      kicker,
      customTitle,
      placement: row.placement,
      countryId: row.countryId ?? "",
      countryIds: row.countryId ? [row.countryId] : [],
      status: row.status,
      startDate: row.startDate?.slice(0, 10) ?? "",
      endDate: row.endDate?.slice(0, 10) ?? "",
    });
    setPreviewUrls({ image: row.image, mobileImage: row.mobileImage || undefined });
    setShowModal(true);
  }, []);

  const columns = useMemo(
    () => [
      {
        key: "image",
        label: "Preview",
        width: "80px",
        render: (row: Banner) => (
          <img src={row.image} alt="" className="h-10 w-16 rounded border border-[#E6E6E6] object-cover bg-[#F2F2F2]" />
        ),
      },
      {
        key: "title",
        label: "Title & Link",
        render: (row: Banner) => (
          <div className="pr-3 min-w-0">
            <div className="font-semibold text-[#1A1A1A] text-[13px] truncate">{row.title}</div>
            <div className="text-[11px] text-[#9A9A9A] truncate">{row.linkUrl || "No link specified"}</div>
          </div>
        ),
      },
      {
        key: "placement",
        label: "Placement & Type",
        width: "230px",
        render: (row: Banner) => {
          const cfg = PLACEMENT_CONFIG[row.placement] || {
            label: row.placement.replace(/_/g, " "),
            page: "Storefront",
            context: row.placement,
            cardinality: "MULTIPLE" as const,
            cardinalityLabel: "Standard",
            badgeColor: "bg-gray-100 text-gray-700 border-gray-200",
          };
          return (
            <div className="space-y-1">
              <span
                className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${cfg.badgeColor}`}
              >
                {cfg.page} • {cfg.context}
              </span>
              <div className="text-[10.5px] font-medium text-gray-400">
                {cfg.cardinality === "MULTIPLE" ? "Multi-Slide (Reorderable)" : "Single-Slot Banner"}
              </div>
            </div>
          );
        },
      },
      {
        key: "country",
        label: "Country",
        width: "80px",
        render: (row: Banner) => (
          <div className="text-[12.5px] font-medium text-[#555]">{row.country?.code ?? "All"}</div>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: "110px",
      },
      {
        key: "actions",
        label: "Actions",
        width: "90px",
        render: (row: Banner) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => edit(row)}
              title="Edit banner"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#555] hover:bg-gray-50 hover:text-[#1A1A1A] transition-colors"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => setDeleting(row.id)}
              title="Delete banner"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [updateBanner.isPending, updateBanner.variables, toggleStatus, edit]
  );

  const set = (key: keyof typeof form, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const openNew = () => {
    let defaultPlacement = "HOMEPAGE_HERO";
    if (selectedPlacement && !singleSlotTaken[selectedPlacement]) {
      defaultPlacement = selectedPlacement;
    } else if (activeGroup !== "ALL" && currentGroup.placements.length > 0) {
      const available = currentGroup.placements.find((p) => !singleSlotTaken[p]);
      if (available) defaultPlacement = available;
    }
    setForm({
      ...empty,
      placement: defaultPlacement,
    });
    setPreviewUrls({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(empty);
    setPreviewUrls({});
  };

  const save = async (event?: React.FormEvent) => {
    if (event?.preventDefault) event.preventDefault();
    const selectedCountries = form.countryIds?.length ? form.countryIds : form.countryId ? [form.countryId] : [];

    let linkTextPayload: string | null = null;
    if (form.showOverlay) {
      linkTextPayload = JSON.stringify({
        showOverlay: true,
        kicker: form.kicker?.trim() || "Modern Orthodontics",
        customTitle: form.customTitle?.trim() || form.title?.trim() || "",
        buttonText: form.linkText?.trim() || "",
      });
    } else if (form.linkText?.trim()) {
      linkTextPayload = JSON.stringify({
        showOverlay: false,
        buttonText: form.linkText.trim(),
      });
    }

    const basePayload = {
      title: form.title,
      image: form.image,
      mobileImage: form.mobileImage || null,
      linkUrl: form.linkUrl || null,
      linkText: linkTextPayload,
      placement: form.placement,
      countryIds: selectedCountries,
      countryId: selectedCountries[0] || null,
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };

    try {
      if (form.id) {
        await updateBanner.mutateAsync({ ...basePayload, id: form.id });
      } else {
        await createBanner.mutateAsync(basePayload);
      }
      closeModal();
      showToast("Banner saved successfully.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save banner."), "error");
    }
  };

  const upload = async (field: "image" | "mobileImage", file?: File) => {
    if (!file) return;
    setUploading(field);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (form.id) formData.append("bannerId", form.id);

      const response = await adminApi.post("/banners/upload-image", formData);
      const data = response.data?.data;
      if (data) {
        if (field === "image") {
          set("image", data.desktopKey);
          setPreviewUrls((prev) => ({ ...prev, image: data.desktopUrl }));
          // If mobile image is not yet set, automatically provide the mobile variant
          if (!form.mobileImage) {
            set("mobileImage", data.mobileKey);
            setPreviewUrls((prev) => ({ ...prev, mobileImage: data.mobileUrl }));
          }
        } else {
          set("mobileImage", data.mobileKey);
          setPreviewUrls((prev) => ({ ...prev, mobileImage: data.mobileUrl }));
        }
        showToast("Banner image optimized and uploaded.");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Upload failed."), "error");
    } finally {
      setUploading(null);
    }
  };

  const handleBulkAction = async () => {
    if (!selected.length) return;
    if (bulkAction === "delete") {
      setShowBulkDeleteModal(true);
      return;
    }
    try {
      await bulkBanners.mutateAsync({ ids: selected, action: bulkAction });
      setSelected([]);
      showToast(bulkAction === "enable" ? "Selected banners enabled." : "Selected banners disabled.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const handleConfirmBulkDelete = async () => {
    try {
      await bulkBanners.mutateAsync({ ids: selected, action: "delete" });
      setSelected([]);
      showToast("Selected banners deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk delete failed."), "error");
    } finally {
      setShowBulkDeleteModal(false);
    }
  };

  return (
    <AdminLayout title="Banners" breadcrumb={[{ label: "Banners" }]}>
      {/* Top Header & Page Group Tabs */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Primary Page Group Tabs */}
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-[#E6E6E6] bg-gray-50/80 p-1">
            {PAGE_GROUPS.map((g) => {
              const count = counts.groupMap[g.id] ?? 0;
              const isSelected = activeGroup === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleSelectGroup(g.id)}
                  className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                    isSelected
                      ? "bg-white text-[#E31E24] shadow-xs border border-gray-200/80"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  }`}
                >
                  <span>{g.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10.5px] font-bold ${
                      isSelected ? "bg-red-50 text-[#E31E24]" : "bg-gray-200/80 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Button: Placement-Aware */}
          {isSingleSlotActive && singleSlotBanner ? (
            <button
              onClick={() => edit(singleSlotBanner)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white shadow-xs hover:bg-[#B5151B] transition-colors"
            >
              <Edit2 size={14} /> Edit Banner / Replace Image
            </button>
          ) : (
            <button
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white shadow-xs hover:bg-[#B5151B] transition-colors"
            >
              <Plus size={15} /> {selectedPlacement === "HOMEPAGE_HERO" ? "New Slide" : "New Banner"}
            </button>
          )}
        </div>

        {/* Secondary Sub-Placement Filters (if current group has multiple placements) */}
        {currentGroup.placements.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[12px] font-semibold text-gray-500 mr-1">Placements in {currentGroup.label}:</span>
            <button
              type="button"
              onClick={() => handleSelectPlacement("")}
              className={`rounded-md border px-3 py-1 text-[12px] font-semibold transition-colors ${
                placement === ""
                  ? "border-[#1A1A1A] bg-[#1A1A1A] text-white shadow-xs"
                  : "border-[#E6E6E6] bg-white text-[#555] hover:bg-gray-50"
              }`}
            >
              All {currentGroup.label} ({counts.groupMap[currentGroup.id] ?? 0})
            </button>
            {currentGroup.placements.map((pKey) => {
              const cfg = PLACEMENT_CONFIG[pKey];
              const pCount = counts.placementMap[pKey] ?? 0;
              const isPSelected = placement === pKey;
              return (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => handleSelectPlacement(pKey)}
                  className={`rounded-md border px-3 py-1 text-[12px] font-semibold transition-colors ${
                    isPSelected
                      ? "border-[#E31E24] bg-[#E31E24] text-white shadow-xs"
                      : "border-[#E6E6E6] bg-white text-[#555] hover:bg-gray-50"
                  }`}
                >
                  {cfg?.context || pKey.replace(/_/g, " ")}{" "}
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10.5px] ${
                      isPSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {pCount}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Contextual Description Guidance */}
      <div className="mb-4 rounded-lg border border-[#E6E6E6] bg-gray-50/70 px-4 py-2.5 text-[12.5px] text-[#555]">
        <span className="font-semibold text-[#1A1A1A]">Placement Guidance:</span>{" "}
        {selectedPlacement && PLACEMENT_CONFIG[selectedPlacement]
          ? PLACEMENT_CONFIG[selectedPlacement].description
          : "Managing promotional banners and header imagery across Storefront pages."}
      </div>

      {/* View Switching: Dedicated Single-Slot Banner Card vs Reorderable Table */}
      {isSingleSlotActive && singleSlotBanner ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-bold ${
                    PLACEMENT_CONFIG[singleSlotBanner.placement]?.badgeColor
                  }`}
                >
                  {PLACEMENT_CONFIG[singleSlotBanner.placement]?.page} •{" "}
                  {PLACEMENT_CONFIG[singleSlotBanner.placement]?.context}
                </span>
                <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">
                  Single-Slot Placement (Max 1 Banner)
                </span>
              </div>
              <h3 className="text-[17px] font-bold text-gray-900">{singleSlotBanner.title}</h3>
              <p className="text-[12.5px] text-gray-500">
                {singleSlotBanner.linkUrl ? (
                  <span>
                    CTA Destination:{" "}
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 font-mono text-[11.5px]">
                      {singleSlotBanner.linkUrl}
                    </code>
                    {singleSlotBanner.linkText && (
                      <span className="ml-2 text-gray-500">({singleSlotBanner.linkText})</span>
                    )}
                  </span>
                ) : (
                  "No CTA link specified (visual only)"
                )}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => edit(singleSlotBanner)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-xs"
              >
                <Edit2 size={14} /> Edit Banner / Replace Image
              </button>
              <button
                type="button"
                onClick={() => setDeleting(singleSlotBanner.id)}
                title="Delete Banner"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Desktop Image Preview */}
            <div className="space-y-1.5">
              <span className="text-[12px] font-semibold text-gray-700">Desktop Banner Preview</span>
              <div className="relative aspect-[21/9] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <img
                  src={singleSlotBanner.image}
                  alt={singleSlotBanner.title}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {/* Mobile Image or Meta */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[12px] font-semibold text-gray-700">Mobile Banner Override</span>
                {singleSlotBanner.mobileImage ? (
                  <div className="relative aspect-[16/9] w-full max-w-[240px] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    <img
                      src={singleSlotBanner.mobileImage}
                      alt="Mobile Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-[90px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 text-[12px] text-gray-400">
                    No mobile override specified (defaults to desktop visual)
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3.5 text-[12.5px] text-gray-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Live Status:</span>
                  <TableStatusAction
                    status={singleSlotBanner.status}
                    loading={updateBanner.isPending && updateBanner.variables?.id === singleSlotBanner.id}
                    onToggle={() => toggleStatus(singleSlotBanner)}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Target Region:</span>
                  <span className="font-semibold text-gray-800">{singleSlotBanner.country?.name || "All Countries"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Schedule:</span>
                  <span className="text-gray-700">
                    {singleSlotBanner.startDate ? new Date(singleSlotBanner.startDate).toLocaleDateString() : "Immediate"} —{" "}
                    {singleSlotBanner.endDate ? new Date(singleSlotBanner.endDate).toLocaleDateString() : "Indefinite"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <DataTable
          title="Banners"
          description="Manage promotional banners across Storefront placements."
          columns={columns}
          data={banners}
          rowKey="id"
          isLoading={isLoading}
          emptyMessage="No banners found for this placement."
          enableSelection={true}
          selectedIds={selected}
          onSelectionChange={setSelected}
          enableReorder={selectedPlacement === "HOMEPAGE_HERO"}
          onReorder={async (items) => {
            try {
              await reorderBanners.mutateAsync(items.map((item) => item.id));
              showToast("Banners reordered.");
            } catch (error) {
              showToast(getAdminErrorMessage(error, "Failed to reorder banners."), "error");
            }
          }}
          disabledReorder={reorderBanners.isPending}
          onToggleStatus={toggleStatus}
          statusLoadingId={updateBanner.isPending ? updateBanner.variables?.id : null}
          renderBulkActions={(selectedIds) => (
            <AdminBulkActionsBar
              selectedCount={selectedIds.length}
              onClear={() => setSelected([])}
              actionType={bulkAction}
              onActionTypeChange={(val) => setBulkAction(val)}
              actions={[
                { value: "enable", label: "Enable" },
                { value: "disable", label: "Disable" },
                { value: "delete", label: "Delete" },
              ]}
              onApply={handleBulkAction}
              applyLoading={bulkBanners.isPending}
            />
          )}
        />
      )}

      {/* Unified Modal Component for Add & Edit */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#E31E24]">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight">
                {form.id ? "Edit Banner" : "Create New Banner"}
              </h3>
              <p className="text-[12px] text-gray-500 mt-0.5">
                {form.id ? `Editing configuration for "${form.title || "Untitled Banner"}"` : "Configure banner artwork, storefront placement, target link, and schedule"}
              </p>
            </div>
          </div>
        }
        size="2xl"
        panelClassName="max-w-4xl max-h-[92vh] flex flex-col"
        bodyClassName="p-0 bg-[#F9FAFB]"
        footer={
          <div className="flex w-full items-center justify-between">
            <p className="text-[12px] text-gray-400">
              * Required fields
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                type="button"
                onClick={() => save()}
                loading={createBanner.isPending || updateBanner.isPending}
                loadingText="Saving..."
                className="inline-flex items-center gap-2 rounded-lg bg-[#E31E24] px-6 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-xs cursor-pointer"
              >
                <Save size={15} /> {form.id ? "Save Changes" : "Create Banner"}
              </LoadingButton>
            </div>
          </div>
        }
      >
        <form onSubmit={save} className="p-6 space-y-5">
          {/* Section 1: Placement & Status */}
          <div className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-blue-50 text-[11px] font-bold text-blue-600">1</span>
                <h4 className="text-[14px] font-bold text-gray-900">Placement & Visibility</h4>
              </div>
              <span className="text-[11.5px] text-gray-400 font-medium">Core Configuration</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminInput
                label="Banner Title *"
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                placeholder="e.g. Curio Brackets Promo"
                required
              />
              <AdminSelect
                label="Status"
                value={form.status ? "true" : "false"}
                onChange={(event) => set("status", event.target.value === "true")}
                options={[
                  { value: "true", label: "Active (Visible on Storefront)" },
                  { value: "false", label: "Inactive (Hidden)" },
                ]}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <AdminSelect
                  label="Placement Position"
                  value={form.placement}
                  onChange={(event) => set("placement", event.target.value)}
                  options={availablePlacementOptions}
                />
                {form.placement && PLACEMENT_CONFIG[form.placement] && (
                  <div className="rounded-md bg-blue-50/70 px-3 py-1.5 text-[11.5px] text-blue-800 border border-blue-100/60 leading-relaxed">
                    <span className="font-semibold">{PLACEMENT_CONFIG[form.placement].context}:</span> {PLACEMENT_CONFIG[form.placement].description}
                  </div>
                )}
              </div>

              <AdminMultiSearchableSelect
                label="Target Countries"
                values={form.countryIds ?? (form.countryId ? [form.countryId] : [])}
                onValuesChange={(values) =>
                  setForm((prev) => ({ ...prev, countryIds: values, countryId: values[0] ?? "" }))
                }
                options={(countries as any[]).map((country) => ({
                  value: country.id,
                  label: `${country.name} (${country.code})`,
                }))}
                placeholder="Select target countries"
                allowSelectAll
                selectAllLabel="All countries (Global)"
              />
            </div>
          </div>

          {/* Section 2: Banner Artwork & Media */}
          <div className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-red-50 text-[11px] font-bold text-[#E31E24]">2</span>
                <h4 className="text-[14px] font-bold text-gray-900">Banner Artwork & Media</h4>
              </div>
              <span className="text-[11.5px] text-gray-400 font-medium">Desktop & Mobile Images</span>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Desktop Image */}
              <div className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-bold text-gray-900">Desktop Image *</span>
                    <p className="text-[11px] text-gray-500">Recommended: 1920 × 480px (PNG, WebP, JPG)</p>
                  </div>
                  {previewUrls.image || form.image ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 border border-emerald-200">
                      Uploaded
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 border border-amber-200">
                      Required
                    </span>
                  )}
                </div>

                <div className="relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-neutral-900 shadow-inner">
                  {previewUrls.image || form.image ? (
                    <>
                      <img
                        src={previewUrls.image || form.image}
                        alt="Desktop Banner Preview"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMediaSelector({ open: true, field: "image" })}
                          className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-900 shadow-sm hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          Change Image
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
                        <ImageIcon size={20} />
                      </div>
                      <p className="text-[12px] text-gray-400">No desktop image selected</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMediaSelector({ open: true, field: "image" })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs cursor-pointer"
                  >
                    <ImageIcon size={14} /> Browse Media Library
                  </button>
                </div>

                <AdminInput
                  label="Direct Image Key / URL"
                  value={String(form.image ?? "")}
                  onChange={(event) => {
                    set("image", event.target.value);
                    setPreviewUrls((prev) => ({ ...prev, image: event.target.value }));
                  }}
                  placeholder="banners/... or https://..."
                />
              </div>

              {/* Mobile Image */}
              <div className="flex flex-col rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-bold text-gray-900">Mobile Override (Optional)</span>
                    <p className="text-[11px] text-gray-500">Recommended: 768 × 600px</p>
                  </div>
                  {previewUrls.mobileImage || form.mobileImage ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 border border-emerald-200">
                      Uploaded
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] font-semibold text-gray-500">
                      Auto-Scales Desktop
                    </span>
                  )}
                </div>

                <div className="relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-neutral-900 shadow-inner">
                  {previewUrls.mobileImage || form.mobileImage ? (
                    <>
                      <img
                        src={previewUrls.mobileImage || form.mobileImage}
                        alt="Mobile Banner Preview"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMediaSelector({ open: true, field: "mobileImage" })}
                          className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-900 shadow-sm hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          Change Image
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
                        <ImageIcon size={20} />
                      </div>
                      <p className="text-[12px] text-gray-400">Uses desktop image if empty</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMediaSelector({ open: true, field: "mobileImage" })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <ImageIcon size={14} /> Browse Media Library
                  </button>
                  {(previewUrls.mobileImage || form.mobileImage) && (
                    <button
                      type="button"
                      onClick={() => {
                        set("mobileImage", "");
                        setPreviewUrls((prev) => ({ ...prev, mobileImage: "" }));
                      }}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <AdminInput
                  label="Direct Mobile Key / URL"
                  value={String(form.mobileImage ?? "")}
                  onChange={(event) => {
                    set("mobileImage", event.target.value);
                    setPreviewUrls((prev) => ({ ...prev, mobileImage: event.target.value }));
                  }}
                  placeholder="banners/... or https://..."
                />
              </div>
            </div>
          </div>

          {/* Section 3: Storefront Text & Tag Overlay */}
          <div className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-amber-50 text-[11px] font-bold text-amber-600">3</span>
                <h4 className="text-[14px] font-bold text-gray-900">Storefront Text & Tag Overlay</h4>
              </div>
              <span className="text-[11.5px] text-gray-400 font-medium">Title & Tag Visibility</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/70 p-3.5">
                <div className="space-y-0.5">
                  <div className="text-[13px] font-bold text-gray-900">
                    Display Banner Title & Badge on Storefront
                  </div>
                  <p className="text-[12px] text-gray-500">
                    Enable if you want text overlay (e.g., &quot;Modern Orthodontics&quot; badge and headline) over your banner.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={form.showOverlay}
                    onChange={(e) => set("showOverlay", e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#E31E24] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                </label>
              </div>

              {form.showOverlay && (
                <div className="grid gap-4 sm:grid-cols-2 pt-1">
                  <AdminInput
                    label="Badge / Tag Text (Kicker)"
                    value={form.kicker}
                    onChange={(event) => set("kicker", event.target.value)}
                    placeholder="e.g. Modern Orthodontics or Since 1994"
                  />
                  <AdminInput
                    label="Headline Title Overlay"
                    value={form.customTitle || form.title}
                    onChange={(event) => set("customTitle", event.target.value)}
                    placeholder="e.g. Banner Headline"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Link Destination & Scheduling */}
          <div className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-purple-50 text-[11px] font-bold text-purple-700">4</span>
                <h4 className="text-[14px] font-bold text-gray-900">Destination & Scheduling (Optional)</h4>
              </div>
              <span className="text-[11.5px] text-gray-400 font-medium">Target Action & Dates</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminInput
                label="Target Link URL"
                value={form.linkUrl}
                onChange={(event) => set("linkUrl", event.target.value)}
                placeholder="e.g. /products/curio or https://..."
              />
              <AdminInput
                label="Button Label (Optional)"
                value={form.linkText}
                onChange={(event) => set("linkText", event.target.value)}
                placeholder="e.g. Explore Products (leave empty if in image artwork)"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AdminInput
                label="Start Date (Optional)"
                type="date"
                value={form.startDate}
                onChange={(event) => set("startDate", event.target.value)}
              />
              <AdminInput
                label="End Date (Optional)"
                type="date"
                value={form.endDate}
                onChange={(event) => set("endDate", event.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleting}
        title="Delete banner?"
        message="This will permanently delete this banner record."
        onCancel={() => setDeleting(null)}
        isLoading={deleteBanner.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteBanner.mutateAsync(deleting);
            showToast("Banner deleted.");
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to delete banner."), "error");
          } finally {
            setDeleting(null);
          }
        }}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        open={showBulkDeleteModal}
        title={`Delete ${selected.length} ${selected.length === 1 ? "banner" : "banners"}?`}
        message="This will permanently delete the selected banner records. This action cannot be undone."
        onCancel={() => setShowBulkDeleteModal(false)}
        isLoading={bulkBanners.isPending}
        onConfirm={handleConfirmBulkDelete}
      />

      <MediaSelectorModal
        open={mediaSelector.open}
        onClose={() => setMediaSelector((prev) => ({ ...prev, open: false }))}
        initialType="image"
        onSelect={(media) => {
          const field = mediaSelector.field;
          set(field, media.url);
          setPreviewUrls((prev) => ({ ...prev, [field]: media.url }));
          showToast("Banner image selected.");
        }}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
