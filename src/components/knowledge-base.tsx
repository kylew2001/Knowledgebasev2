"use client";

import { useState } from "react";
import { BookOpen, ChevronRight, FileText, FolderPlus, Home, PenLine, Plus, Search, Upload } from "lucide-react";
import { categoryCards, mockPosts, type MockPost } from "@/lib/mock-data";
import CardBuilderModal from "@/components/CardBuilderModal";
import SubCategoryModal from "@/components/SubCategoryModal";
import NewPostModal from "@/components/NewPostModal";
import PostPage from "@/components/PostPage";

type Category = (typeof categoryCards)[number] & { subcategories: string[] };

const initialCategories: Category[] = categoryCards.map((c) => ({ ...c }));

const typeConfig = {
  pdf:     { label: "PDF",     icon: FileText, bg: "bg-orange-50", fg: "text-orange-600" },
  written: { label: "Written", icon: PenLine,  bg: "bg-blue-50",   fg: "text-blue-600"   },
  both:    { label: "Both",    icon: BookOpen,  bg: "bg-teal-50",   fg: "text-teal-700"   }
} as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

export function KnowledgeBase({ userRole = "viewer" }: { userRole?: string }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [posts, setPosts] = useState<MockPost[]>(mockPosts);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<MockPost | null>(null);
  const [showCardBuilder, setShowCardBuilder] = useState(false);
  const [showSubCategory, setShowSubCategory] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [search, setSearch] = useState("");

  function goHome() { setSelectedCategory(null); setSelectedSubcategory(null); setSelectedPost(null); }
  function goCategory(cat: Category) { setSelectedCategory(cat); setSelectedSubcategory(null); setSelectedPost(null); }

  function handleAddSubCategory(name: string) {
    if (!selectedCategory) return;
    const updated = categories.map((c) =>
      c.title === selectedCategory.title ? { ...c, subcategories: [...c.subcategories, name] } : c
    );
    setCategories(updated);
    setSelectedCategory(updated.find((c) => c.title === selectedCategory.title) ?? null);
  }

  function handleAddPost(post: MockPost) {
    setPosts((prev) => [post, ...prev]);
  }

  const subcategoryPosts = posts.filter(
    (p) => p.category === selectedCategory?.title && p.subcategory === selectedSubcategory
  );

  const level = selectedSubcategory ? 2 : selectedCategory ? 1 : 0;

  const headerTitle =
    level === 2 ? selectedSubcategory!
    : level === 1 ? selectedCategory!.title
    : "IT support articles, PDFs, and runbooks";

  if (selectedPost && selectedCategory) {
    return (
      <PostPage
        post={selectedPost}
        userRole={userRole as import("@/lib/auth").UserRole}
        categoryTitle={selectedCategory.title}
        onBack={() => setSelectedPost(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 shadow-soft md:flex-row md:items-center md:justify-between">
        <div>
          {level > 0 && (
            <p className="mb-1 text-sm font-semibold text-slate-400">
              Knowledge Base{level > 1 && <> · <span className="text-slate-500">{selectedCategory!.title}</span></>}
            </p>
          )}
          <p className="text-sm font-semibold text-brand">Knowledge Base</p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal text-ink">{headerTitle}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {level === 0 && (
            <button onClick={() => setShowCardBuilder(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              <FolderPlus className="h-4 w-4" /> Category
            </button>
          )}
          {level === 1 && (
            <button onClick={() => setShowSubCategory(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              <FolderPlus className="h-4 w-4" /> Sub Category
            </button>
          )}
          {level === 2 && (
            <button onClick={() => setShowNewPost(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              <Plus className="h-4 w-4" /> New Post
            </button>
          )}
          <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
            <Upload className="h-4 w-4" /> Bulk PDFs
          </button>
        </div>
      </header>

      <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 shadow-soft">
        <Search className="h-5 w-5 shrink-0 text-slate-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search articles, PDFs, tags, categories..." />
      </div>

      {/* Level 0 — categories */}
      {level === 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <button key={category.title} onClick={() => goCategory(category)} className="focus-ring rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg text-white" style={{ backgroundColor: category.color }}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-ink">{category.title}</h3>
                <p className="mt-2 min-h-[4rem] text-sm leading-6 text-slate-600">{category.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {category.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-slate-600">{tag}</span>
                  ))}
                </div>
                <p className="mt-4 text-xs font-semibold text-slate-500">{category.count} resources</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Level 1 — subcategories */}
      {level === 1 && selectedCategory && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button onClick={goHome} className="focus-ring rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel">
            <div className="mb-4 flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                <Home className="h-6 w-6 text-slate-500" />
              </span>
              <ChevronRight className="h-5 w-5 rotate-180 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-ink">All categories</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Return to the main knowledge base.</p>
          </button>

          {selectedCategory.subcategories.map((name) => {
            const Icon = selectedCategory.icon;
            const count = posts.filter((p) => p.category === selectedCategory.title && p.subcategory === name).length;
            return (
              <button key={name} onClick={() => setSelectedSubcategory(name)} className="focus-ring rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg text-white" style={{ backgroundColor: selectedCategory.color }}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-ink">{name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{selectedCategory.title} · subcategory</p>
                {count > 0 && <p className="mt-3 text-xs font-semibold text-slate-500">{count} post{count !== 1 ? "s" : ""}</p>}
              </button>
            );
          })}
        </div>
      )}

      {/* Level 2 — posts */}
      {level === 2 && selectedCategory && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Back card */}
          <button onClick={() => setSelectedSubcategory(null)} className="focus-ring rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel">
            <div className="mb-4 flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
                <Home className="h-6 w-6 text-slate-500" />
              </span>
              <ChevronRight className="h-5 w-5 rotate-180 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-ink">{selectedCategory.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Back to subcategories.</p>
          </button>

          {subcategoryPosts.length === 0 && (
            <div className="col-span-full py-12 text-center text-sm text-slate-400">
              No posts yet — click <strong>New Post</strong> to add the first one.
            </div>
          )}

          {subcategoryPosts.map((post) => {
            const cfg = typeConfig[post.type];
            const TypeIcon = cfg.icon;
            return (
              <button key={post.id} onClick={() => setSelectedPost(post)} className="focus-ring rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <TypeIcon className={`h-6 w-6 ${cfg.fg}`} />
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-base font-bold leading-snug text-ink">{post.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-slate-600">{cfg.label}</span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {post.publishedBy} · {formatDate(post.publishedAt)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {showCardBuilder && <CardBuilderModal onClose={() => setShowCardBuilder(false)} />}
      {showSubCategory && selectedCategory && (
        <SubCategoryModal categoryTitle={selectedCategory.title} onClose={() => setShowSubCategory(false)} onAdd={handleAddSubCategory} />
      )}
      {showNewPost && selectedCategory && selectedSubcategory && (
        <NewPostModal
          categoryTitle={selectedCategory.title}
          subcategoryTitle={selectedSubcategory}
          publishedBy="Kyle W"
          onClose={() => setShowNewPost(false)}
          onAdd={handleAddPost}
        />
      )}
    </div>
  );
}
