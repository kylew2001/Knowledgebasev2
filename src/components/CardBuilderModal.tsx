"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { iconOptions } from "@/lib/mock-data";
import { type VisibilityGroup, type VisibilityRule } from "@/lib/visibility";
import VisibilityEditor from "@/components/VisibilityEditor";

const colorOptions = ["#0f766e", "#2563eb", "#b45309", "#7c3aed", "#be123c", "#475569"];

type Props = {
  groups: VisibilityGroup[];
  onClose: () => void;
  onAdd: (category: {
    title: string;
    description: string;
    count: number;
    icon: (typeof iconOptions)[number]["icon"];
    color: string;
    tags: string[];
    subcategories: string[];
    visibility: VisibilityRule;
    subcategoryVisibility: Record<string, VisibilityRule>;
  }) => void;
};

export default function CardBuilderModal({ groups, onClose, onAdd }: Props) {
  const [selectedIcon, setSelectedIcon] = useState(iconOptions[0].name);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<VisibilityRule>({ mode: "everyone", groupIds: [] });

  const PreviewIcon = iconOptions.find((o) => o.name === selectedIcon)?.icon ?? iconOptions[0].icon;

  function handleCreate() {
    if (!name.trim()) return;
    onAdd({
      title: name.trim(),
      description: description.trim(),
      count: 0,
      icon: PreviewIcon,
      color: selectedColor,
      tags: [],
      subcategories: [],
      visibility,
      subcategoryVisibility: {}
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4">
      <div className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-soft sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">New category</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-panel">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Microsoft 365"
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Short description of this category…"
              className="focus-ring mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Icon</span>
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
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colour</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`focus-ring h-8 w-8 rounded-full border-2 ${selectedColor === color ? "border-ink" : "border-white"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-panel p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: selectedColor }}
              >
                <PreviewIcon className="h-6 w-6" />
              </span>
              <div>
                <p className="font-bold text-ink">{name || "Category name"}</p>
                <p className="text-sm text-slate-500">{description || "Description…"}</p>
              </div>
            </div>
          </div>

          <VisibilityEditor
            label="Category visibility"
            visibility={visibility}
            groups={groups}
            onChange={setVisibility}
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="focus-ring h-11 flex-1 rounded-lg border border-line text-sm font-semibold text-ink hover:bg-panel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="focus-ring h-11 flex-1 rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800"
          >
            Create category
          </button>
        </div>
      </div>
    </div>
  );
}
