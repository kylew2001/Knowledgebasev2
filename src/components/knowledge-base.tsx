"use client";

import { useState } from "react";
import {
  ChevronRight,
  FilePlus2,
  FolderPlus,
  Palette,
  Search,
  Upload
} from "lucide-react";
import { categoryCards, iconOptions, subcategoryCards } from "@/lib/mock-data";

const colorOptions = ["#0f766e", "#2563eb", "#b45309", "#7c3aed", "#be123c", "#475569"];

export function KnowledgeBase() {
  const [selectedCategory, setSelectedCategory] = useState(categoryCards[0]);
  const [selectedIcon, setSelectedIcon] = useState(iconOptions[0].name);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 shadow-soft md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">Knowledge Base</p>
          <h2 className="mt-1 text-3xl font-bold tracking-normal text-ink">
            IT support articles, PDFs, and runbooks
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
            <FolderPlus className="h-4 w-4" />
            Category
          </button>
          <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
            <Upload className="h-4 w-4" />
            Bulk PDFs
          </button>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2">
            <Search className="h-5 w-5 text-slate-500" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search articles, PDFs, tags, categories..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categoryCards.map((category) => {
              const Icon = category.icon;
              const selected = selectedCategory.title === category.title;
              return (
                <button
                  key={category.title}
                  onClick={() => setSelectedCategory(category)}
                  className={`focus-ring rounded-lg border p-4 text-left transition ${
                    selected
                      ? "border-brand bg-teal-50"
                      : "border-line bg-white hover:border-slate-300 hover:bg-panel"
                  }`}
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
                  <p className="mt-2 min-h-16 text-sm leading-6 text-slate-600">
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
                  <p className="mt-4 text-xs font-semibold text-slate-500">
                    {category.count} resources
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-line bg-white p-4">
            <div className="mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-brand" />
              <h3 className="text-base font-bold text-ink">Card Builder</h3>
            </div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Icon
            </label>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {iconOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.name}
                    title={option.name}
                    onClick={() => setSelectedIcon(option.name)}
                    className={`focus-ring flex aspect-square items-center justify-center rounded-lg border ${
                      selectedIcon === option.name
                        ? "border-brand bg-teal-50"
                        : "border-line bg-white hover:bg-panel"
                    }`}
                  >
                    <Icon className="h-5 w-5" style={{ color: selectedColor }} />
                  </button>
                );
              })}
            </div>
            <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Icon Colour
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  title={color}
                  onClick={() => setSelectedColor(color)}
                  className={`focus-ring h-8 w-8 rounded-full border-2 ${
                    selectedColor === color ? "border-ink" : "border-white"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-4">
            <h3 className="text-base font-bold text-ink">{selectedCategory.title}</h3>
            <p className="mt-1 text-sm text-slate-600">Subcategory cards</p>
            <div className="mt-4 space-y-2">
              {subcategoryCards.map((name) => (
                <button
                  key={name}
                  className="focus-ring flex w-full items-center justify-between rounded-lg border border-line bg-panel px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-mist"
                >
                  {name}
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
            <button className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
              <FilePlus2 className="h-4 w-4" />
              Add Manual/PDF Article
            </button>
          </div>
        </aside>
      </section>

      <section className="rounded-lg border border-line bg-white p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-bold text-ink">Bulk upload flow</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Select PDFs, choose category/subcategory, then apply tags before upload.
            </p>
          </div>
          <select className="focus-ring h-11 rounded-lg border border-line bg-white px-3 text-sm">
            <option>Microsoft 365</option>
            <option>Active Directory</option>
            <option>Networking</option>
          </select>
          <input
            type="file"
            multiple
            accept="application/pdf"
            className="focus-ring h-11 rounded-lg border border-line bg-white px-3 py-2 text-sm"
          />
        </div>
      </section>
    </div>
  );
}
