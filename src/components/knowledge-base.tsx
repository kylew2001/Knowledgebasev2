"use client";

import { useState } from "react";
import { ChevronRight, FolderPlus, Home, Search, Upload } from "lucide-react";
import { categoryCards } from "@/lib/mock-data";
import CardBuilderModal from "@/components/CardBuilderModal";
import SubCategoryModal from "@/components/SubCategoryModal";

type Category = (typeof categoryCards)[number] & { subcategories: string[] };

const initialCategories: Category[] = categoryCards.map((c) => ({ ...c }));

export function KnowledgeBase() {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showCardBuilder, setShowCardBuilder] = useState(false);
  const [showSubCategory, setShowSubCategory] = useState(false);
  const [search, setSearch] = useState("");

  function handleAddSubCategory(name: string) {
    if (!selectedCategory) return;
    const updated = categories.map((c) =>
      c.title === selectedCategory.title
        ? { ...c, subcategories: [...c.subcategories, name] }
        : c
    );
    setCategories(updated);
    setSelectedCategory(updated.find((c) => c.title === selectedCategory.title) ?? null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 shadow-soft md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">Knowledge Base</p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal text-ink">
            {selectedCategory ? selectedCategory.title : "IT support articles, PDFs, and runbooks"}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedCategory ? (
            <button
              onClick={() => setShowSubCategory(true)}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <FolderPlus className="h-4 w-4" />
              Sub Category
            </button>
          ) : (
            <button
              onClick={() => setShowCardBuilder(true)}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <FolderPlus className="h-4 w-4" />
              Category
            </button>
          )}
          <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
            <Upload className="h-4 w-4" />
            Bulk PDFs
          </button>
        </div>
      </header>

      <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 shadow-soft">
        <Search className="h-5 w-5 shrink-0 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Search articles, PDFs, tags, categories..."
        />
      </div>

      {selectedCategory ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className="focus-ring rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel"
          >
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
            return (
              <button
                key={name}
                className="focus-ring rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: selectedCategory.color }}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-ink">{name}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {selectedCategory.title} · subcategory
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.title}
                onClick={() => setSelectedCategory(category)}
                className="focus-ring rounded-lg border border-line bg-white p-4 text-left transition hover:border-slate-300 hover:bg-panel"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: category.color }}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-ink">{category.title}</h3>
                <p className="mt-2 min-h-[4rem] text-sm leading-6 text-slate-600">
                  {category.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {category.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-mist px-2 py-1 text-xs font-semibold text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-xs font-semibold text-slate-500">{category.count} resources</p>
              </button>
            );
          })}
        </div>
      )}

      {showCardBuilder && <CardBuilderModal onClose={() => setShowCardBuilder(false)} />}
      {showSubCategory && selectedCategory && (
        <SubCategoryModal
          categoryTitle={selectedCategory.title}
          onClose={() => setShowSubCategory(false)}
          onAdd={handleAddSubCategory}
        />
      )}
    </div>
  );
}
