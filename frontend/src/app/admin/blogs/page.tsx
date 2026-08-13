"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileText, Tag, Users, Globe, FileEdit } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminStatsGrid } from "@/components/admin/AdminComponents";
import { BlogPostsTab } from "@/components/admin/blogs/BlogPostsTab";
import { BlogCategoriesTab } from "@/components/admin/blogs/BlogCategoriesTab";
import { BlogAuthorsTab } from "@/components/admin/blogs/BlogAuthorsTab";
import { useAdminBlogs, useAdminBlogCategories, useAdminBlogAuthors } from "@/hooks/admin/useAdminHooks";

type TabId = "posts" | "categories" | "authors";

const tabs: Array<{ id: TabId; label: string; icon: typeof FileText }> = [
  { id: "posts", label: "Blog Posts", icon: FileText },
  { id: "categories", label: "Categories", icon: Tag },
  { id: "authors", label: "Authors", icon: Users },
];

function AdminBlogHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab") || "posts";
  const activeTab: TabId = (["posts", "categories", "authors"].includes(rawTab) ? rawTab : "posts") as TabId;

  const { data: postsData, isLoading: isLoadingPosts } = useAdminBlogs({ limit: 100 });
  const { data: categoriesData = [], isLoading: isLoadingCategories } = useAdminBlogCategories();
  const { data: authorsData = [], isLoading: isLoadingAuthors } = useAdminBlogAuthors();

  const totalPosts = postsData?.pagination?.total ?? 0;
  const postsList = postsData?.data ?? [];
  const publishedCount = postsList.filter((p: { status: string }) => p.status === "PUBLISHED").length;
  const draftCount = postsList.filter((p: { status: string }) => p.status === "DRAFT" || p.status === "SCHEDULED").length;

  const handleTabChange = (tabId: TabId) => {
    router.push(`/admin/blogs?tab=${tabId}`);
  };

  const activeTabObject = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <AdminLayout
      title="Blog Management"
      breadcrumb={[
        { label: "Blog", href: "/admin/blogs" },
        { label: activeTabObject.label },
      ]}
    >
      {/* Reusable Admin Stats Grid */}
      <AdminStatsGrid
        stats={[
          {
            title: "Total Blog Posts",
            value: totalPosts,
            subtitle: "All articles created",
            icon: <FileText size={18} />,
          },
          {
            title: "Published Articles",
            value: publishedCount,
            subtitle: "Visible on Storefront",
            icon: <Globe size={18} />,
            color: "bg-green-600",
          },
          {
            title: "Drafts & Scheduled",
            value: draftCount,
            subtitle: "Unpublished posts",
            icon: <FileEdit size={18} />,
            color: "bg-amber-600",
          },
          {
            title: "Categories & Authors",
            value: `${categoriesData.length} / ${authorsData.length}`,
            subtitle: "Taxonomy & Contributors",
            icon: <Tag size={18} />,
            color: "bg-[#0F6CBD]",
          },
        ]}
        isLoading={isLoadingPosts || isLoadingCategories || isLoadingAuthors}
      />

      {/* Tab Navigation Header */}
      <div className="mb-6 overflow-hidden rounded-xl border border-[#E6E6E6] bg-white shadow-sm">
        <div className="border-b border-[#E6E6E6] bg-[#FAFAFA] px-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-4 py-3 text-[13.5px] font-semibold transition-colors ${
                    isActive
                      ? "border-[#E31E24] text-[#E31E24] bg-white rounded-t-lg shadow-sm"
                      : "border-transparent text-[#666] hover:text-[#1A1A1A] hover:bg-white/50"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                  {tab.id === "posts" && totalPosts > 0 && (
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${isActive ? "bg-red-100 text-[#E31E24]" : "bg-gray-200 text-gray-700"}`}>
                      {totalPosts}
                    </span>
                  )}
                  {tab.id === "categories" && categoriesData.length > 0 && (
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${isActive ? "bg-red-100 text-[#E31E24]" : "bg-gray-200 text-gray-700"}`}>
                      {categoriesData.length}
                    </span>
                  )}
                  {tab.id === "authors" && authorsData.length > 0 && (
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${isActive ? "bg-red-100 text-[#E31E24]" : "bg-gray-200 text-gray-700"}`}>
                      {authorsData.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "posts" && <BlogPostsTab />}
          {activeTab === "categories" && <BlogCategoriesTab />}
          {activeTab === "authors" && <BlogAuthorsTab />}
        </div>
      </div>
    </AdminLayout>
  );
}

export default function AdminBlogsPage() {
  return (
    <Suspense fallback={null}>
      <AdminBlogHubContent />
    </Suspense>
  );
}

