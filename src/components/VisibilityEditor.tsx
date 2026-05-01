"use client";

import { type VisibilityGroup, type VisibilityRule, getGroupPath } from "@/lib/visibility";

type Props = {
  label: string;
  visibility: VisibilityRule;
  groups: VisibilityGroup[];
  onChange: (visibility: VisibilityRule) => void;
};

export default function VisibilityEditor({ label, visibility, groups, onChange }: Props) {
  return (
    <div>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-2 space-y-3 rounded-lg border border-line p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange({ mode: "everyone", groupIds: [] })}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              visibility.mode === "everyone" ? "border-brand bg-teal-50 text-brand" : "border-line text-slate-600 hover:bg-panel"
            }`}
          >
            Everyone
          </button>
          <button
            type="button"
            onClick={() => onChange({ mode: "groups", groupIds: visibility.groupIds })}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              visibility.mode === "groups" ? "border-brand bg-teal-50 text-brand" : "border-line text-slate-600 hover:bg-panel"
            }`}
          >
            Selected groups
          </button>
        </div>

        {visibility.mode === "groups" && (
          <div className="max-h-48 space-y-2 overflow-auto rounded-lg bg-panel p-3">
            {groups.length === 0 ? (
              <p className="text-sm text-slate-500">No groups configured.</p>
            ) : (
              groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={visibility.groupIds.includes(group.id)}
                    onChange={(e) =>
                      onChange({
                        mode: "groups",
                        groupIds: e.target.checked
                          ? [...visibility.groupIds, group.id]
                          : visibility.groupIds.filter((id) => id !== group.id)
                      })
                    }
                    className="h-4 w-4 rounded border-line"
                  />
                  {getGroupPath(group, groups)}
                </label>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
