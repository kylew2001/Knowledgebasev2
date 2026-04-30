"use client";

import { useState } from "react";
import { BookOpen, ChevronRight, FileText, FolderPlus, Home, Pencil, PenLine, Plus, Search, Upload, X } from "lucide-react";
import { categoryCards, iconOptions, mockPosts, type MockPost } from "@/lib/mock-data";
import CardBuilderModal from "@/components/CardBuilderModal";
import SubCategoryModal from "@/components/SubCategoryModal";
import NewPostModal from "@/components/NewPostModal";
import { PostPage } from "@/components/PostPage";

type Category = (typeof categoryCards)[number] & { subcategories: string[] };

const initialCategories: Category[] = categoryCards.map((c) => ({ ...c }));

const typeConfig = {
  pdf:     { label: "PDF",     icon: FileText, bg: "bg-orange-50", fg: "text-orange-600" },
  written: { label: "Written", icon: PenLine,  bg: "bg-blue-50",   fg: "text-blue-600"   },
  both:    { label: "Both",    icon: BookOpen,  bg: "bg-teal-50",   fg: "text-teal-700"   }
} as const;

const COLORS = [
  "#0f766e","#2563eb","#b45309","#7c3aed",
  "#be123c","#475569","#0369a1","#15803d",
  "#c2410c","#0e7490","#6d28d9","#9f1239",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// ── Edit-category modal ──────────────────────────────────────────────────────

type EditCategoryModalProps = {
  category: Category;
  onClose: () => void;
  onSave: (updated: Partial<Category>) => void;
};

function EditCategoryModal({ category, onClose, onSave }: EditCategoryModalProps) {
  const [title, setTitle] = useState(category.title);
  const [description, setDescription] = useState(category.description);
  const [color, setColor] = useState(category.color);
  const [iconName, setIconName] = useState(
    iconOptions.find((o) => o.icon === category.icon)?.name ?? iconOptions[0].name
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const selectedIcon = iconOptions.find((o) => o.name === iconName)?.icon ?? category.icon;
    onSave({ title: title.trim(), description: description.trim(), color, icon: selectedIcon });
    onClose();
  }

  const PreviewIcon = iconOptions.find((o) => o.name === iconName)?.icon ?? category.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Edit category</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-panel"><X className="h-5 w-5 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Name</span>
            <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)}
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="focus-ring mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm" />
          </label>
          <div>
            <span className="text-sm font-semibold text-slate-700">Icon</span>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {iconOptions.map((opt) => {
                const I = opt.icon;
                return (
                  <button key={opt.name} type="button" onClick={() => setIconName(opt.name)}
                    className={`flex h-10 w-full items-center justify-center rounded-lg border transition ${iconName === opt.name ? "border-brand bg-teal-50 text-brand" : "border-line bg-white text-slate-500 hover:bg-panel"}`}>
                    <I className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <span className="text-sm font-semibold text-slate-700">Colour</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition ${color === c ? "border-ink scale-110" : "border-transparent hover:scale-105"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-line bg-panel p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: color }}>
              <PreviewIcon className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-ink">{title || "Category name"}</span>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="focus-ring h-11 flex-1 rounded-lg border border-line text-sm font-semibold text-ink hover:bg-panel">Cancel</button>
            <button className="focus-ring h-11 flex-1 rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800">Save changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit-subcategory modal ───────────────────────────────────────────────────

type EditSubCategoryModalProps = {
  name: string;
  categoryTitle: string;
  onClose: () => void;
  onSave: (newName: string) => void;
};

function EditSubCategoryModal({ name, categoryTitle, onClose, onSave }: EditSubCategoryModalProps) {
  const [value, setValue] = useState(name);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSave(value.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Edit subcategory</h2>
            <p className="text-sm text-slate-500">{categoryTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-panel"><X className="h-5 w-5 text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Name</span>
            <input autoFocus required value={value} onChange={(e) => setValue(e.target.value)}
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3" />
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="focus-ring h-11 flex-1 rounded-lg border border-line text-sm font-semibold text-ink hover:bg-panel">Cancel</button>
            <button className="focus-ring h-11 flex-1 rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function KnowledgeBase({ userRole = "viewer" }: { userRole?: string }) {
  const canEdit = userRole === "super_admin" || userRole === "editor";

  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [posts, setPosts] = useState<MockPost[]>(mockPosts);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<MockPost | null>(null);
  const [showCardBuilder, setShowCardBuilder] = useState(false);
  const [showSubCategory, setShowSubCategory] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [search, setSearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<string | null>(null);

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

  function handleSaveCategory(updated: Partial<Category>) {
    if (!editingCategory) return;
    const oldTitle = editingCategory.title;
    const next = categories.map((c) =>
      c.title === oldTitle ? { ...c, ...updated } : c
    );
    setCategories(next);
    if (selectedCategory?.title === oldTitle) {
      setSelectedCategory(next.find((c) => c.title === (updated.title ?? oldTitle)) ?? null);
    }
  }

  function handleSaveSubcategory(newName: string) {
    if (!editingSubcategory || !selectedCategory) return;
    const oldName = editingSubcategory;
    const updatedCats = categories.map((c) =>
      c.title === selectedCategory.title
        ? { ...c, subcategories: c.subcategories.map((s) => (s === oldName ? newName : s)) }
        : c
    );
    setCategories(updatedCats);
    setSelectedCategory(updatedCats.find((c) => c.title === selectedCategory.title) ?? null);
    if (selectedSubcategory === oldName) setSelectedSubcategory(newName);
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
          {level === 0 && canEdit && (
            <button onClick={() => setShowCardBuilder(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              <FolderPlus className="h-4 w-4" /> Category
            </button>
          )}
          {level === 1 && canEdit && (
            <button onClick={() => setShowSubCategory(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              <FolderPlus className="h-4 w-4" /> Sub Category
            </button>
          )}
          {level === 2 && canEdit && (
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
              <div key={category.title} className="relative">
                <button onClick={() => goCategory(category)} className="focus-ring w-full rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel">
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
                {canEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingCategory(category); }}
                    className="absolute right-2 top-2 rounded-md p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                    title="Edit category"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
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
              <div key={name} className="relative">
                <button onClick={() => setSelectedSubcategory(name)} className="focus-ring w-full rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel">
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
                {canEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingSubcategory(name); }}
                    className="absolute right-2 top-2 rounded-md p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                    title="Edit subcategory"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Level 2 — posts */}
      {level === 2 && selectedCategory && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      {editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={handleSaveCategory}
        />
      )}
      {editingSubcategory && selectedCategory && (
        <EditSubCategoryModal
          name={editingSubcategory}
          categoryTitle={selectedCategory.title}
          onClose={() => setEditingSubcategory(null)}
          onSave={handleSaveSubcategory}
        />
      )}
    </div>
  );
}
