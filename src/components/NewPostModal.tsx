"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { type MockPost } from "@/lib/mock-data";
import { type VisibilityGroup, type VisibilityRule } from "@/lib/visibility";
import VisibilityEditor from "@/components/VisibilityEditor";

type Props = {
  categoryTitle: string;
  subcategoryTitle: string;
  publishedBy: string;
  groups: VisibilityGroup[];
  onClose: () => void;
  onAdd: (post: MockPost) => void;
};

export default function NewPostModal({
  categoryTitle,
  subcategoryTitle,
  publishedBy,
  groups,
  onClose,
  onAdd
}: Props) {
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<VisibilityRule>({ mode: "everyone", groupIds: [] });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      id: crypto.randomUUID(),
      title: title.trim(),
      publishedBy,
      publishedAt: new Date().toISOString().split("T")[0],
      type: undefined,
      widgets: [],
      visibility,
      subcategory: subcategoryTitle,
      category: categoryTitle
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4">
      <div className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-soft sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">New post</h2>
            <p className="text-sm text-slate-500">
              {categoryTitle} - {subcategoryTitle}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-panel">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Title</span>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How to reset a password"
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">PDF file</span>
            <input
              type="file"
              accept="application/pdf"
              disabled
              title="PDF attachments will be re-added in future when more database storage is added."
              className="mt-2 w-full cursor-not-allowed rounded-lg border border-line bg-slate-100 px-3 py-2 text-sm text-slate-400"
            />
            <span className="mt-1 block text-xs font-semibold text-slate-400">
              PDF attachments will be re-added in future when more database storage is added.
            </span>
          </label>

          <VisibilityEditor
            label="Post visibility"
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
              Create and edit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
