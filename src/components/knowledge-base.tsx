"use client";

import { useState, useEffect } from "react";
import { BookOpen, ChevronRight, Clock, FileText, FolderPlus, Home, Pencil, PenLine, Pin, Plus, Search, Star, X } from "lucide-react";
import { categoryCards, iconOptions, mockPosts, type MockPost } from "@/lib/mock-data";
import CardBuilderModal from "@/components/CardBuilderModal";
import SubCategoryModal from "@/components/SubCategoryModal";
import NewPostModal from "@/components/NewPostModal";
import { PostPage } from "@/components/PostPage";
import { derivePostType, getPostWidgets } from "@/lib/post-content";
import { canSeeVisibility, everyoneVisibility, getVisibilityLabel, type VisibilityGroup, type VisibilityRule } from "@/lib/visibility";
import VisibilityEditor from "@/components/VisibilityEditor";
import {
  markPostViewed,
  savePostToDatabase,
  savePostsToDatabase,
  setPostFavourited,
  setPostPinned,
  type PostUserState
} from "@/app/(app)/knowledge-base/actions";

type Category = (typeof categoryCards)[number] & {
  subcategories: string[];
  visibility?: VisibilityRule;
  subcategoryVisibility?: Record<string, VisibilityRule>;
};

type LocalPostUserState = Record<string, {
  pinned_at: string | null;
  favourited_at: string | null;
  last_viewed_at: string | null;
}>;

const initialCategories: Category[] = categoryCards.map((c) => ({ ...c }));
const POST_STORAGE_KEY = "knowledgebase-v2-posts";
const POST_DB_MIGRATION_KEY = "knowledgebase-v2-posts-db-migrated";

const typeConfig = {
  pdf:     { label: "PDF",     icon: FileText, bg: "bg-orange-50", fg: "text-orange-600" },
  written: { label: "Written", icon: PenLine,  bg: "bg-blue-50",   fg: "text-blue-600"   },
  both:    { label: "Both",    icon: BookOpen,  bg: "bg-teal-50",   fg: "text-teal-700"   },
  empty:   { label: "Empty",   icon: BookOpen,  bg: "bg-slate-100", fg: "text-slate-500"  }
} as const;

const COLORS = [
  "#0f766e","#2563eb","#b45309","#7c3aed",
  "#be123c","#475569","#0369a1","#15803d",
  "#c2410c","#0e7490","#6d28d9","#9f1239",
];

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

function getTypeConfig(type: MockPost["type"] | string | null | undefined) {
  if (type === "pdf" || type === "written" || type === "both" || type === "empty") {
    return typeConfig[type];
  }

  return typeConfig.written;
}

function getStoredPostType(widgets: import("@/lib/post-content").Widget[]) {
  const derivedType = derivePostType(widgets);
  return derivedType === "empty" ? undefined : derivedType;
}

function loadStoredPosts() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(POST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MockPost[]) : null;
  } catch {
    return null;
  }
}

function mergePostsWithSeedData(databasePosts: MockPost[]) {
  if (!databasePosts.length) return mockPosts;

  const databaseIds = new Set(databasePosts.map((post) => post.id));
  return [...databasePosts, ...mockPosts.filter((post) => !databaseIds.has(post.id))];
}

function getCategoryResourceCount(posts: MockPost[], categoryTitle: string) {
  return posts.filter((post) => post.category === categoryTitle).length;
}

function getPostSearchText(post: MockPost) {
  const widgetText = getPostWidgets(post)
    .map((widget) => {
      if (widget.type === "text" || widget.type === "callout") return widget.content;
      if (widget.type === "code") return `${widget.language} ${widget.filename ?? ""} ${widget.content}`;
      if (widget.type === "steps") return `${widget.title ?? ""} ${widget.steps.map((step) => step.text).join(" ")}`;
      if (widget.type === "checklist") return `${widget.title ?? ""} ${widget.items.map((item) => item.text).join(" ")}`;
      if (widget.type === "table") return `${widget.title ?? ""} ${widget.columns.join(" ")} ${widget.rows.flat().join(" ")}`;
      if (widget.type === "quote") return `${widget.content} ${widget.source ?? ""}`;
      if (widget.type === "link") return `${widget.label} ${widget.url} ${widget.description ?? ""}`;
      if (widget.type === "image") return `${widget.caption} ${widget.src}`;
      if (widget.type === "pdf") return widget.filename;
      return "";
    })
    .join(" ");

  return [
    post.title,
    post.category,
    post.subcategory,
    post.publishedBy,
    post.type,
    widgetText
  ].join(" ").toLowerCase();
}

function getInitialPostUserState(rows: PostUserState[]): LocalPostUserState {
  return Object.fromEntries(
    rows.map((row) => [
      row.post_id,
      {
        pinned_at: row.pinned_at,
        favourited_at: row.favourited_at,
        last_viewed_at: row.last_viewed_at
      }
    ])
  );
}

type PostQuickCardProps = {
  post: MockPost;
  state?: LocalPostUserState[string];
  onOpen: (post: MockPost) => void;
  onTogglePinned: (post: MockPost) => void;
  onToggleFavourite: (post: MockPost) => void;
};

function PostQuickCard({ post, state, onOpen, onTogglePinned, onToggleFavourite }: PostQuickCardProps) {
  const derivedType = derivePostType(getPostWidgets(post));
  const cfg = getTypeConfig(derivedType);
  const TypeIcon = cfg.icon;
  const pinned = Boolean(state?.pinned_at);
  const favourited = Boolean(state?.favourited_at);

  return (
    <div className="relative rounded-lg border border-line bg-white p-4 shadow-soft transition hover:border-slate-300 hover:bg-panel">
      <button type="button" onClick={() => onOpen(post)} className="focus-ring block w-full text-left">
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${cfg.bg}`}>
            <TypeIcon className={`h-6 w-6 ${cfg.fg}`} />
          </span>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </div>
        <h3 className="pr-12 text-base font-bold leading-snug text-ink">{post.title || "Untitled post"}</h3>
        <p className="mt-2 text-xs text-slate-500">{post.category} / {post.subcategory}</p>
        <p className="mt-3 text-xs text-slate-500">{post.publishedBy || "Unknown"} - {formatDate(post.publishedAt)}</p>
      </button>
      <div className="absolute right-3 top-3 flex gap-1">
        <button type="button" title={pinned ? "Unpin post" : "Pin post"} onClick={() => onTogglePinned(post)} className={`focus-ring flex h-8 w-8 items-center justify-center rounded-lg border ${pinned ? "border-brand bg-teal-50 text-brand" : "border-line bg-white text-slate-400 hover:text-brand"}`}>
          <Pin className="h-4 w-4" />
        </button>
        <button type="button" title={favourited ? "Remove favourite" : "Favourite post"} onClick={() => onToggleFavourite(post)} className={`focus-ring flex h-8 w-8 items-center justify-center rounded-lg border ${favourited ? "border-amber-300 bg-amber-50 text-amber-600" : "border-line bg-white text-slate-400 hover:text-amber-600"}`}>
          <Star className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Edit-category modal ──────────────────────────────────────────────────────

type EditCategoryModalProps = {
  category: Category;
  groups: VisibilityGroup[];
  onClose: () => void;
  onSave: (updated: Partial<Category>) => void;
};

function EditCategoryModal({ category, groups, onClose, onSave }: EditCategoryModalProps) {
  const [title, setTitle] = useState(category.title);
  const [description, setDescription] = useState(category.description);
  const [tagsText, setTagsText] = useState(category.tags.join(", "));
  const [color, setColor] = useState(category.color);
  const [iconName, setIconName] = useState(
    iconOptions.find((o) => o.icon === category.icon)?.name ?? iconOptions[0].name
  );
  const [visibility, setVisibility] = useState<VisibilityRule>(category.visibility ?? everyoneVisibility);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const selectedIcon = iconOptions.find((o) => o.name === iconName)?.icon ?? category.icon;
    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    onSave({ title: title.trim(), description: description.trim(), tags, color, icon: selectedIcon, visibility });
    onClose();
  }

  const PreviewIcon = iconOptions.find((o) => o.name === iconName)?.icon ?? category.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4">
      <div className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-soft sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6">
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
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Tags</span>
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="Exchange, Teams, Licensing"
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Separate tags with commas.
            </span>
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
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{title || "Category name"}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {tagsText
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .map((tag) => (
                    <span key={tag} className="rounded-md bg-mist px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {tag}
                    </span>
                  ))}
              </div>
            </div>
          </div>
          <VisibilityEditor
            label="Category visibility"
            visibility={visibility}
            groups={groups}
            onChange={setVisibility}
          />
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
  groups: VisibilityGroup[];
  visibility: VisibilityRule;
  onClose: () => void;
  onSave: (newName: string, visibility: VisibilityRule) => void;
};

function EditSubCategoryModal({ name, categoryTitle, groups, visibility: initialVisibility, onClose, onSave }: EditSubCategoryModalProps) {
  const [value, setValue] = useState(name);
  const [visibility, setVisibility] = useState<VisibilityRule>(initialVisibility);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onSave(value.trim(), visibility);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4">
      <div className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-soft sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6">
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
          <VisibilityEditor
            label="Subcategory visibility"
            visibility={visibility}
            groups={groups}
            onChange={setVisibility}
          />
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

export function KnowledgeBase({
  userRole = "viewer",
  userGroupIds = [],
  groups = [],
  initialPosts = [],
  initialPostUserState = []
}: {
  userRole?: string;
  userGroupIds?: string[];
  groups?: VisibilityGroup[];
  initialPosts?: MockPost[];
  initialPostUserState?: PostUserState[];
}) {
  const canEdit = userRole === "super_admin" || userRole === "editor";
  const adminGroupId = groups.find((group) => group.name.toLowerCase() === "admin")?.id;
  const canSeeAll =
    canEdit ||
    (adminGroupId
      ? canSeeVisibility({ mode: "groups", groupIds: [adminGroupId] }, userGroupIds, groups)
      : false);

  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [posts, setPosts] = useState<MockPost[]>(() => mergePostsWithSeedData(initialPosts));
  const [postUserState, setPostUserState] = useState<LocalPostUserState>(() => getInitialPostUserState(initialPostUserState));
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<MockPost | null>(null);
  const [showCardBuilder, setShowCardBuilder] = useState(false);
  const [showSubCategory, setShowSubCategory] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [search, setSearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => { setSelectedCategory(null); setSelectedSubcategory(null); setSelectedPost(null); setSearch(""); };
    window.addEventListener("kb-navigate-home", handler);
    return () => window.removeEventListener("kb-navigate-home", handler);
  }, []);

  useEffect(() => {
    const storedPosts = loadStoredPosts();
    const alreadyMigrated = window.localStorage.getItem(POST_DB_MIGRATION_KEY) === "true";

    if (storedPosts && canEdit && !alreadyMigrated) {
      setPosts(storedPosts);
      void savePostsToDatabase(storedPosts).then((result) => {
        if (result.ok) {
          window.localStorage.setItem(POST_DB_MIGRATION_KEY, "true");
          window.localStorage.removeItem(POST_STORAGE_KEY);
        }
      });
    }
  }, [canEdit]);

  function goHome() { setSelectedCategory(null); setSelectedSubcategory(null); setSelectedPost(null); setSearch(""); }
  function goCategory(cat: Category) { setSelectedCategory(cat); setSelectedSubcategory(null); setSelectedPost(null); }
  function openPost(post: MockPost, categoryOverride?: Category | null) {
    const category = categoryOverride ?? categories.find((cat) => cat.title === post.category) ?? null;
    setSelectedCategory(category);
    setSelectedSubcategory(post.subcategory);
    setSelectedPost(post);
    const viewedAt = new Date().toISOString();
    setPostUserState((prev) => ({
      ...prev,
      [post.id]: {
        pinned_at: prev[post.id]?.pinned_at ?? null,
        favourited_at: prev[post.id]?.favourited_at ?? null,
        last_viewed_at: viewedAt
      }
    }));
    void markPostViewed(post.id);
  }
  function openSearchPost(post: MockPost) {
    openPost(post);
    setSearch("");
  }

  function handleTogglePinned(post: MockPost) {
    const nextPinnedAt = postUserState[post.id]?.pinned_at ? null : new Date().toISOString();
    setPostUserState((prev) => ({
      ...prev,
      [post.id]: {
        pinned_at: nextPinnedAt,
        favourited_at: prev[post.id]?.favourited_at ?? null,
        last_viewed_at: prev[post.id]?.last_viewed_at ?? null
      }
    }));
    void setPostPinned(post.id, Boolean(nextPinnedAt));
  }

  function handleToggleFavourite(post: MockPost) {
    const nextFavouritedAt = postUserState[post.id]?.favourited_at ? null : new Date().toISOString();
    setPostUserState((prev) => ({
      ...prev,
      [post.id]: {
        pinned_at: prev[post.id]?.pinned_at ?? null,
        favourited_at: nextFavouritedAt,
        last_viewed_at: prev[post.id]?.last_viewed_at ?? null
      }
    }));
    void setPostFavourited(post.id, Boolean(nextFavouritedAt));
  }

  function handleAddCategory(category: Category) {
    setCategories((prev) => [...prev, category]);
  }

  function handleAddSubCategory(name: string, visibility: VisibilityRule) {
    if (!selectedCategory) return;
    const updated = categories.map((c) =>
      c.title === selectedCategory.title
        ? {
            ...c,
            subcategories: [...c.subcategories, name],
            subcategoryVisibility: { ...(c.subcategoryVisibility ?? {}), [name]: visibility }
          }
        : c
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
    if (updated.title && updated.title !== oldTitle) {
      setPosts((prev) => {
        const nextPosts = prev.map((post) =>
          post.category === oldTitle ? { ...post, category: updated.title! } : post
        );
        void savePostsToDatabase(nextPosts.filter((post) => post.category === updated.title));
        return nextPosts;
      });
    }
    setCategories(next);
    if (selectedCategory?.title === oldTitle) {
      setSelectedCategory(next.find((c) => c.title === (updated.title ?? oldTitle)) ?? null);
    }
  }

  function handleSaveSubcategory(newName: string, visibility: VisibilityRule) {
    if (!editingSubcategory || !selectedCategory) return;
    const oldName = editingSubcategory;
    const updatedCats = categories.map((c) =>
      c.title === selectedCategory.title
        ? {
            ...c,
            subcategories: c.subcategories.map((s) => (s === oldName ? newName : s)),
            subcategoryVisibility: Object.fromEntries(
              Object.entries({ ...(c.subcategoryVisibility ?? {}), [newName]: visibility })
                .filter(([key]) => key !== oldName)
            )
          }
        : c
    );
    setCategories(updatedCats);
    setSelectedCategory(updatedCats.find((c) => c.title === selectedCategory.title) ?? null);
    if (selectedSubcategory === oldName) setSelectedSubcategory(newName);
  }

  function handleAddPost(post: MockPost) {
    setPosts((prev) => [post, ...prev]);
    void savePostToDatabase(post);
  }

  function handleSavePost(postId: string, widgets: import("@/lib/post-content").Widget[], visibility: VisibilityRule) {
    const nextType = getStoredPostType(widgets);
    setPosts((prev) => {
      let savedPost: MockPost | null = null;
      const nextPosts = prev.map((post) => {
        if (post.id !== postId) return post;
        savedPost = { ...post, widgets, visibility, type: nextType };
        return savedPost;
      });

      if (savedPost) void savePostToDatabase(savedPost);
      return nextPosts;
    });
    setSelectedPost((current) =>
      current?.id === postId
        ? { ...current, widgets, visibility, type: nextType }
        : current
    );
  }

  const visibleCategories = categories.filter((category) =>
    canSeeVisibility(category.visibility, userGroupIds, groups, canSeeAll)
  );
  const visibleSubcategories = selectedCategory?.subcategories.filter((name) =>
    canSeeVisibility(selectedCategory.subcategoryVisibility?.[name], userGroupIds, groups, canSeeAll)
  ) ?? [];

  const subcategoryPosts = posts.filter(
    (p) =>
      p.category === selectedCategory?.title &&
      p.subcategory === selectedSubcategory &&
      canSeeVisibility(p.visibility, userGroupIds, groups, canSeeAll)
  );
  const searchQuery = search.trim().toLowerCase();
  const searchResults = searchQuery
    ? posts.filter((post) => {
        const category = categories.find((cat) => cat.title === post.category);

        return (
          canSeeVisibility(post.visibility, userGroupIds, groups, canSeeAll) &&
          canSeeVisibility(category?.visibility, userGroupIds, groups, canSeeAll) &&
          canSeeVisibility(category?.subcategoryVisibility?.[post.subcategory], userGroupIds, groups, canSeeAll) &&
          getPostSearchText(post).includes(searchQuery)
        );
      })
    : [];
  const visiblePosts = posts.filter((post) => {
    const category = categories.find((cat) => cat.title === post.category);
    return (
      canSeeVisibility(post.visibility, userGroupIds, groups, canSeeAll) &&
      canSeeVisibility(category?.visibility, userGroupIds, groups, canSeeAll) &&
      canSeeVisibility(category?.subcategoryVisibility?.[post.subcategory], userGroupIds, groups, canSeeAll)
    );
  });
  const visiblePostMap = new Map(visiblePosts.map((post) => [post.id, post]));
  const pinnedPosts = Object.entries(postUserState)
    .filter(([, state]) => state.pinned_at)
    .sort(([, a], [, b]) => new Date(b.pinned_at ?? 0).getTime() - new Date(a.pinned_at ?? 0).getTime())
    .map(([postId]) => visiblePostMap.get(postId))
    .filter((post): post is MockPost => Boolean(post))
    .slice(0, 6);
  const favouritePosts = Object.entries(postUserState)
    .filter(([, state]) => state.favourited_at)
    .sort(([, a], [, b]) => new Date(b.favourited_at ?? 0).getTime() - new Date(a.favourited_at ?? 0).getTime())
    .map(([postId]) => visiblePostMap.get(postId))
    .filter((post): post is MockPost => Boolean(post))
    .slice(0, 6);
  const recentPosts = Object.entries(postUserState)
    .filter(([, state]) => state.last_viewed_at)
    .sort(([, a], [, b]) => new Date(b.last_viewed_at ?? 0).getTime() - new Date(a.last_viewed_at ?? 0).getTime())
    .map(([postId]) => visiblePostMap.get(postId))
    .filter((post): post is MockPost => Boolean(post))
    .slice(0, 6);

  const level = selectedSubcategory ? 2 : selectedCategory ? 1 : 0;

  const headerTitle =
    level === 2 ? selectedSubcategory!
    : level === 1 ? selectedCategory!.title
    : "IT support articles and runbooks";

  if (selectedPost && selectedCategory) {
    return (
      <PostPage
        post={selectedPost}
        userRole={userRole as import("@/lib/auth").UserRole}
        categoryTitle={selectedCategory.title}
        onBack={() => setSelectedPost(null)}
        groups={groups}
        onSavePost={(widgets, visibility) => handleSavePost(selectedPost.id, widgets, visibility)}
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
        </div>
      </header>

      <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 shadow-soft">
        <Search className="h-5 w-5 shrink-0 text-slate-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search posts by title, content, category, or subcategory..." />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-panel hover:text-ink"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Level 0 — categories */}
      {searchQuery && (
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-bold text-ink">Search results</h3>
            <p className="text-sm text-slate-500">
              {searchResults.length} post{searchResults.length !== 1 ? "s" : ""} found for "{search.trim()}"
            </p>
          </div>

          {searchResults.length === 0 ? (
            <div className="rounded-lg border border-line bg-white p-8 text-center text-sm text-slate-500 shadow-soft">
              No matching posts found.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((post) => {
                const derivedType = derivePostType(getPostWidgets(post));
                const cfg = getTypeConfig(derivedType);
                const TypeIcon = cfg.icon;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => openSearchPost(post)}
                    className="focus-ring rounded-lg border border-line bg-white p-4 text-left shadow-soft transition hover:border-slate-300 hover:bg-panel"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${cfg.bg}`}>
                        <TypeIcon className={`h-6 w-6 ${cfg.fg}`} />
                      </span>
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </div>
                    <h3 className="text-base font-bold leading-snug text-ink">{post.title || "Untitled post"}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-slate-600">{post.category}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{post.subcategory}</span>
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${cfg.bg} ${cfg.fg}`}>{cfg.label}</span>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      {post.publishedBy || "Unknown"} - {formatDate(post.publishedAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!searchQuery && level === 0 && (
        <>
          {(pinnedPosts.length > 0 || favouritePosts.length > 0 || recentPosts.length > 0) && (
            <section className="space-y-4">
              {pinnedPosts.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Pin className="h-4 w-4 text-brand" />
                    <h3 className="text-lg font-bold text-ink">Pinned posts</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {pinnedPosts.map((post) => (
                      <PostQuickCard key={post.id} post={post} state={postUserState[post.id]} onOpen={openPost} onTogglePinned={handleTogglePinned} onToggleFavourite={handleToggleFavourite} />
                    ))}
                  </div>
                </div>
              )}

              {favouritePosts.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <h3 className="text-lg font-bold text-ink">Favourite posts</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {favouritePosts.map((post) => (
                      <PostQuickCard key={post.id} post={post} state={postUserState[post.id]} onOpen={openPost} onTogglePinned={handleTogglePinned} onToggleFavourite={handleToggleFavourite} />
                    ))}
                  </div>
                </div>
              )}

              {recentPosts.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <h3 className="text-lg font-bold text-ink">Recently viewed</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {recentPosts.map((post) => (
                      <PostQuickCard key={post.id} post={post} state={postUserState[post.id]} onOpen={openPost} onTogglePinned={handleTogglePinned} onToggleFavourite={handleToggleFavourite} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {visibleCategories.map((category) => {
              const Icon = category.icon;
              const resourceCount = getCategoryResourceCount(visiblePosts, category.title);
              return (
                <div key={category.title} className="relative">
                  <button onClick={() => goCategory(category)} className="focus-ring w-full rounded-lg border border-line bg-white p-4 pr-12 text-left transition hover:border-slate-300 hover:bg-panel">
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
                    <p className="mt-4 text-xs font-semibold text-slate-500">
                      {resourceCount} resource{resourceCount !== 1 ? "s" : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Visible to {getVisibilityLabel(category.visibility, groups)}
                    </p>
                  </button>
                  {canEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCategory(category); }}
                      className="focus-ring absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-brand hover:bg-teal-50 hover:text-brand"
                      title="Edit category"
                      type="button"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Level 1 — subcategories */}
      {!searchQuery && level === 1 && selectedCategory && (
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

          {visibleSubcategories.map((name) => {
            const Icon = selectedCategory.icon;
            const count = posts.filter((p) =>
              p.category === selectedCategory.title &&
              p.subcategory === name &&
              canSeeVisibility(p.visibility, userGroupIds, groups, canSeeAll)
            ).length;
            return (
              <div key={name} className="relative">
                <button onClick={() => setSelectedSubcategory(name)} className="focus-ring w-full rounded-lg border border-line bg-white p-4 pr-12 text-left transition hover:border-slate-300 hover:bg-panel">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg text-white" style={{ backgroundColor: selectedCategory.color }}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-ink">{name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{selectedCategory.title} · subcategory</p>
                  <p className="mt-2 text-xs text-slate-400">
                    Visible to {getVisibilityLabel(selectedCategory.subcategoryVisibility?.[name], groups)}
                  </p>
                  {count > 0 && <p className="mt-3 text-xs font-semibold text-slate-500">{count} post{count !== 1 ? "s" : ""}</p>}
                </button>
                {canEdit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingSubcategory(name); }}
                    className="focus-ring absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-brand hover:bg-teal-50 hover:text-brand"
                    title="Edit subcategory"
                    type="button"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Level 2 — posts */}
      {!searchQuery && level === 2 && selectedCategory && (
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
            const derivedType = derivePostType(getPostWidgets(post));
            const cfg = getTypeConfig(derivedType);
            const TypeIcon = cfg.icon;
            return (
              <button key={post.id} type="button" onClick={() => openPost(post, selectedCategory)} className="focus-ring rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <TypeIcon className={`h-6 w-6 ${cfg.fg}`} />
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-base font-bold leading-snug text-ink">{post.title || "Untitled post"}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-slate-600">{cfg.label}</span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {post.publishedBy || "Unknown"} · {formatDate(post.publishedAt)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {showCardBuilder && (
        <CardBuilderModal
          groups={groups}
          onClose={() => setShowCardBuilder(false)}
          onAdd={handleAddCategory}
        />
      )}
      {showSubCategory && selectedCategory && (
        <SubCategoryModal
          categoryTitle={selectedCategory.title}
          groups={groups}
          onClose={() => setShowSubCategory(false)}
          onAdd={handleAddSubCategory}
        />
      )}
      {showNewPost && selectedCategory && selectedSubcategory && (
        <NewPostModal
          categoryTitle={selectedCategory.title}
          subcategoryTitle={selectedSubcategory}
          publishedBy="Kyle W"
          groups={groups}
          onClose={() => setShowNewPost(false)}
          onAdd={handleAddPost}
        />
      )}
      {editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          groups={groups}
          onClose={() => setEditingCategory(null)}
          onSave={handleSaveCategory}
        />
      )}
      {editingSubcategory && selectedCategory && (
        <EditSubCategoryModal
          name={editingSubcategory}
          categoryTitle={selectedCategory.title}
          groups={groups}
          visibility={selectedCategory.subcategoryVisibility?.[editingSubcategory] ?? everyoneVisibility}
          onClose={() => setEditingSubcategory(null)}
          onSave={handleSaveSubcategory}
        />
      )}
    </div>
  );
}
