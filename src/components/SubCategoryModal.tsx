"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { type VisibilityGroup, type VisibilityRule } from "@/lib/visibility";
import VisibilityEditor from "@/components/VisibilityEditor";

type Props = {
  categoryTitle: string;
  groups: VisibilityGroup[];
  onClose: () => void;
  onAdd: (name: string, visibility: VisibilityRule) => void;
};

export default function SubCategoryModal({ categoryTitle, groups, onClose, onAdd }: Props) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<VisibilityRule>({ mode: "everyone", groupIds: [] });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim(), visibility);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4">
      <div className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-soft sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">New subcategory</h2>
            <p className="text-sm text-slate-500">Adding to {categoryTitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-panel">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Name</span>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Password Resets"
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          <VisibilityEditor
            label="Subcategory visibility"
            visibility={visibility}
            groups={groups}
            onChange={setVisibility}
          />
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring h-11 flex-1 rounded-lg border border-line text-sm font-semibold text-ink hover:bg-panel"
            >
              Cancel
            </button>
            <button className="focus-ring h-11 flex-1 rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800">
              Add subcategory
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
