"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { type MockPost } from "@/lib/mock-data";
import { derivePostType, type Widget } from "@/lib/post-content";
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
  const [body, setBody] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [visibility, setVisibility] = useState<VisibilityRule>({ mode: "everyone", groupIds: [] });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const widgets: Widget[] = [];

    if (body.trim()) {
      widgets.push({
        id: crypto.randomUUID(),
        type: "text",
        content: body.trim()
      });
    }

    if (pdfName) {
      widgets.push({
        id: crypto.randomUUID(),
        type: "pdf",
        filename: pdfName
      });
    }

    const derivedType = derivePostType(widgets);

    onAdd({
      id: crypto.randomUUID(),
      title: title.trim(),
      publishedBy,
      publishedAt: new Date().toISOString().split("T")[0],
      type: derivedType === "empty" ? undefined : derivedType,
      widgets,
      visibility,
      subcategory: subcategoryTitle,
      category: categoryTitle
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white p-6 shadow-soft">
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
            <span className="text-sm font-semibold text-slate-700">Content</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Write your article content here..."
              className="focus-ring mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">PDF file</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfName(e.target.files?.[0]?.name ?? "")}
              className="focus-ring mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
            />
          </label>

          <p className="rounded-lg bg-panel px-3 py-2 text-xs font-semibold text-slate-500">
            The post type is detected from its widgets: written content, PDF
            attachment, or both.
          </p>

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
              Publish post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
