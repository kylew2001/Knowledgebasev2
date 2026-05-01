"use client";

import { useState, type ChangeEvent, type CSSProperties } from "react";
import {
  AlertTriangle,
  Bold,
  BookOpen,
  ChevronRight,
  FileText,
  Home,
  Image as ImageIcon,
  Info,
  Italic,
  List,
  ListOrdered,
  Minus,
  Palette,
  PenLine,
  Pencil,
  Plus,
  Save,
  Trash2,
  Type,
  Underline,
  X
} from "lucide-react";
import { type MockPost } from "@/lib/mock-data";
import { type UserRole } from "@/lib/auth";
import { derivePostType } from "@/lib/post-content";

// ── Widget types ────────────────────────────────────────────────────────────

type TextWidget = {
  id: string;
  type: "text";
  content: string;
  fontSize?: string;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};
type ImageWidget   = { id: string; type: "image";   src: string; caption: string };
type PdfWidget     = { id: string; type: "pdf";     filename: string };
type CalloutWidget = { id: string; type: "callout"; variant: "info" | "warning" | "success"; content: string };
type DividerWidget = { id: string; type: "divider" };

type Widget = TextWidget | ImageWidget | PdfWidget | CalloutWidget | DividerWidget;

// ── Sample default content for seeded posts ─────────────────────────────────

const defaultContent: Record<string, Widget[]> = {
  "1": [
    { id: "a1", type: "text", content: "Shared mailboxes allow multiple users to read and send email from a common address without requiring a separate licence.\n\n**Steps to create:**\n1. Go to admin.exchange.microsoft.com\n2. Click Mailboxes → Shared → Add\n3. Enter display name and email address\n4. Click Create, then add members" },
    { id: "a2", type: "callout", variant: "info", content: "Shared mailboxes do not require a licence unless the mailbox exceeds 50 GB or you enable litigation hold." },
    { id: "a3", type: "text", content: "**Granting access:**\nOnce created, go to the mailbox properties and add members under Delegation → Send As and Full Access." },
  ],
  "6": [
    { id: "b1", type: "callout", variant: "warning", content: "Always verify the user's identity via video call or in person before resetting a password." },
    { id: "b2", type: "text", content: "**Self-Service (SSPR):**\n1. User visits aka.ms/sspr\n2. Enters their UPN and completes MFA\n3. Sets a new password that meets complexity requirements\n\n**Admin Reset (AD Users & Computers):**\n1. Open ADUC, locate the user\n2. Right-click → Reset Password\n3. Uncheck 'User must change password at next logon' only if requested by a manager" },
  ],
  "8": [
    { id: "c1", type: "text", content: "Complete this checklist before the new starter's first day." },
    { id: "c2", type: "callout", variant: "success", content: "Target: all accounts and hardware ready 24 hours before start date." },
    { id: "c3", type: "text", content: "**Accounts:**\n- [ ] Create AD user account\n- [ ] Assign M365 licence\n- [ ] Add to relevant security groups\n- [ ] Create email signature\n\n**Hardware:**\n- [ ] Enrol device in Intune\n- [ ] Install required software via Intune apps\n- [ ] Confirm device name follows naming convention" },
  ],
  "14": [
    { id: "d1", type: "text", content: "Download the 3CX softphone from the link emailed by the system or from your internal app portal." },
    { id: "d2", type: "callout", variant: "info", content: "Use the QR code provisioning method where possible — it avoids manual server entry errors." },
    { id: "d3", type: "text", content: "**Installation steps:**\n1. Run the installer as administrator\n2. Open 3CX and choose 'Scan QR code'\n3. Log in to the 3CX web portal, go to your extension, and display the QR code\n4. Scan with the desktop app camera prompt\n5. Test inbound and outbound calls" },
  ],
};

function newId() { return Math.random().toString(36).slice(2); }

// ── Widget picker ────────────────────────────────────────────────────────────

const widgetTypes = [
  { type: "text"    as const, label: "Text",    icon: PenLine      },
  { type: "image"   as const, label: "Image",   icon: ImageIcon    },
  { type: "pdf"     as const, label: "PDF",     icon: FileText     },
  { type: "callout" as const, label: "Callout", icon: Info         },
  { type: "divider" as const, label: "Divider", icon: Minus        },
];

function blankWidget(type: Widget["type"]): Widget {
  switch (type) {
    case "text":    return { id: newId(), type: "text", content: "", fontSize: "16px", fontFamily: "Inter, system-ui, sans-serif", color: "#334155" };
    case "image":   return { id: newId(), type: "image", src: "", caption: "" };
    case "pdf":     return { id: newId(), type: "pdf", filename: "" };
    case "callout": return { id: newId(), type: "callout", variant: "info", content: "" };
    case "divider": return { id: newId(), type: "divider" };
  }
}

function AddWidgetBar({ onAdd }: { onAdd: (w: Widget) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex items-center justify-center py-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400 hover:border-brand hover:text-brand"
      >
        <Plus className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute top-9 z-20 flex gap-1 rounded-lg border border-line bg-white p-1 shadow-soft">
          {widgetTypes.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => { onAdd(blankWidget(type)); setOpen(false); }}
              className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-mist"
            >
              <Icon className="h-4 w-4 text-slate-500" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Individual widget renderers ──────────────────────────────────────────────

function TextWidgetView({ w }: { w: TextWidget }) {
  const textStyle: CSSProperties = {
    color: w.color ?? "#334155",
    fontFamily: w.fontFamily ?? "Inter, system-ui, sans-serif",
    fontSize: w.fontSize ?? "16px",
    fontWeight: w.bold ? 700 : 400,
    fontStyle: w.italic ? "italic" : "normal",
    textDecoration: w.underline ? "underline" : "none"
  };

  return (
    <div className="prose prose-sm max-w-none" style={textStyle}>
      {w.content.split("\n").map((line, i) => {
        const bold = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold" style={textStyle}>{line.slice(3)}</h2>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold" style={textStyle} dangerouslySetInnerHTML={{ __html: bold }} />;
        if (line.startsWith("- [ ]")) return <li key={i} className="ml-4 list-none text-slate-600">☐ {line.slice(5)}</li>;
        if (line.startsWith("- ")) return <li key={i} className="ml-5 list-disc" style={textStyle}>{line.slice(2)}</li>;
        if (line.match(/^\d+\./)) return <li key={i} className="ml-5 list-decimal" style={textStyle} dangerouslySetInnerHTML={{ __html: bold }} />;
        if (line === "") return <br key={i} />;
        return <p key={i} style={textStyle} dangerouslySetInnerHTML={{ __html: bold }} />;
      })}
    </div>
  );
}

function TextWidgetEditor({
  widget,
  onChange
}: {
  widget: TextWidget;
  onChange: (widget: TextWidget) => void;
}) {
  function update(patch: Partial<TextWidget>) {
    onChange({ ...widget, ...patch });
  }

  function insertListPrefix(prefix: "- " | "1. ") {
    const lines = widget.content ? widget.content.split("\n") : [""];
    const next = lines.map((line, index) => {
      if (!line.trim()) return prefix === "1. " ? `${index + 1}. ` : "- ";
      if (line.startsWith("- ") || line.match(/^\d+\.\s/)) return line;
      return prefix === "1. " ? `${index + 1}. ${line}` : `- ${line}`;
    });
    update({ content: next.join("\n") });
  }

  const activeButton = "border-brand bg-teal-50 text-brand";
  const inactiveButton = "border-line bg-white text-slate-600 hover:bg-mist";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel p-2">
        <label className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2 text-xs font-semibold text-slate-600">
          <Type className="h-3.5 w-3.5" />
          <select
            value={widget.fontFamily ?? "Inter, system-ui, sans-serif"}
            onChange={(e) => update({ fontFamily: e.target.value })}
            className="bg-transparent outline-none"
          >
            <option value="Inter, system-ui, sans-serif">Default</option>
            <option value="Arial, Helvetica, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="'Times New Roman', Times, serif">Times</option>
            <option value="'Courier New', monospace">Courier</option>
          </select>
        </label>

        <select
          value={widget.fontSize ?? "16px"}
          onChange={(e) => update({ fontSize: e.target.value })}
          className="focus-ring h-8 rounded-lg border border-line bg-white px-2 text-xs font-semibold text-slate-600"
        >
          <option value="13px">Small</option>
          <option value="16px">Normal</option>
          <option value="20px">Large</option>
          <option value="26px">Heading</option>
          <option value="32px">Title</option>
        </select>

        <button type="button" title="Bold" onClick={() => update({ bold: !widget.bold })} className={`focus-ring h-8 w-8 rounded-lg border ${widget.bold ? activeButton : inactiveButton}`}>
          <Bold className="mx-auto h-4 w-4" />
        </button>
        <button type="button" title="Italic" onClick={() => update({ italic: !widget.italic })} className={`focus-ring h-8 w-8 rounded-lg border ${widget.italic ? activeButton : inactiveButton}`}>
          <Italic className="mx-auto h-4 w-4" />
        </button>
        <button type="button" title="Underline" onClick={() => update({ underline: !widget.underline })} className={`focus-ring h-8 w-8 rounded-lg border ${widget.underline ? activeButton : inactiveButton}`}>
          <Underline className="mx-auto h-4 w-4" />
        </button>

        <button type="button" title="Bullet list" onClick={() => insertListPrefix("- ")} className="focus-ring h-8 w-8 rounded-lg border border-line bg-white text-slate-600 hover:bg-mist">
          <List className="mx-auto h-4 w-4" />
        </button>
        <button type="button" title="Numbered list" onClick={() => insertListPrefix("1. ")} className="focus-ring h-8 w-8 rounded-lg border border-line bg-white text-slate-600 hover:bg-mist">
          <ListOrdered className="mx-auto h-4 w-4" />
        </button>

        <label title="Text colour" className="flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2 text-slate-600 hover:bg-mist">
          <Palette className="h-4 w-4" />
          <input
            type="color"
            value={widget.color ?? "#334155"}
            onChange={(e) => update({ color: e.target.value })}
            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
      </div>

      <textarea
        value={widget.content}
        onChange={(e) => update({ content: e.target.value })}
        rows={8}
        placeholder="Write your content here... Use the toolbar for font, size, colour, bold, italic, underline, and lists."
        className="focus-ring w-full rounded-lg border border-line px-3 py-2 text-sm"
        style={{
          color: widget.color ?? "#334155",
          fontFamily: widget.fontFamily ?? "Inter, system-ui, sans-serif",
          fontSize: widget.fontSize ?? "16px",
          fontWeight: widget.bold ? 700 : 400,
          fontStyle: widget.italic ? "italic" : "normal",
          textDecoration: widget.underline ? "underline" : "none"
        }}
      />
    </div>
  );
}

function CalloutView({ w }: { w: CalloutWidget }) {
  const styles = {
    info:    { bg: "bg-blue-50 border-blue-200",   icon: <Info className="h-5 w-5 text-blue-500" />,           text: "text-blue-800" },
    warning: { bg: "bg-amber-50 border-amber-200", icon: <AlertTriangle className="h-5 w-5 text-amber-500" />, text: "text-amber-800" },
    success: { bg: "bg-teal-50 border-teal-200",   icon: <BookOpen className="h-5 w-5 text-teal-600" />,       text: "text-teal-800" },
  };
  const s = styles[w.variant];
  return (
    <div className={`flex gap-3 rounded-lg border p-4 ${s.bg}`}>
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <p className={`text-sm leading-6 ${s.text}`}>{w.content}</p>
    </div>
  );
}

// ── Main PostPage component ──────────────────────────────────────────────────

type Props = {
  post: MockPost;
  userRole: UserRole;
  onBack: () => void;
  categoryTitle: string;
  onSaveWidgets?: (widgets: Widget[]) => void;
};

const typeConfig = {
  pdf:     { label: "PDF",     icon: FileText, bg: "bg-orange-50", fg: "text-orange-600" },
  written: { label: "Written", icon: PenLine,  bg: "bg-blue-50",   fg: "text-blue-600"   },
  both:    { label: "Both",    icon: BookOpen,  bg: "bg-teal-50",   fg: "text-teal-700"   },
  empty:   { label: "Empty",   icon: BookOpen,  bg: "bg-slate-100", fg: "text-slate-500"  },
} as const;

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

export function PostPage({ post, userRole, onBack, categoryTitle, onSaveWidgets }: Props) {
  const canEdit = userRole === "super_admin" || userRole === "editor";
  const [editing, setEditing] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>(post.widgets ?? defaultContent[post.id] ?? []);
  const [draft, setDraft] = useState<Widget[]>(widgets);

  function startEdit() { setDraft(widgets); setEditing(true); }
  function cancelEdit() { setEditing(false); }
  function saveEdit() {
    setWidgets(draft);
    onSaveWidgets?.(draft);
    setEditing(false);
  }

  function insertWidget(w: Widget, afterIndex: number) {
    setDraft((prev) => [...prev.slice(0, afterIndex + 1), w, ...prev.slice(afterIndex + 1)]);
  }

  function deleteWidget(id: string) {
    setDraft((prev) => prev.filter((w) => w.id !== id));
  }

  function updateWidget(updated: Widget) {
    setDraft((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }

  function handleImageSelected(widget: ImageWidget, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      updateWidget({
        ...widget,
        src: reader.result,
        caption: widget.caption || file.name.replace(/\.[^/.]+$/, "")
      });
    };
    reader.readAsDataURL(file);
  }

  const current = editing ? draft : widgets;
  const derivedType = derivePostType(current);
  const cfg = getTypeConfig(derivedType);
  const TypeIcon = cfg.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 shadow-soft md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
            <button onClick={() => onBack()} className="hover:text-slate-600">Knowledge Base</button>
            <ChevronRight className="h-3 w-3" />
            <span>{categoryTitle}</span>
            <ChevronRight className="h-3 w-3" />
            <span>{post.subcategory}</span>
          </div>
          <h2 className="text-2xl font-bold text-ink">{post.title || "Untitled post"}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${cfg.bg} ${cfg.fg}`}>
              <TypeIcon className="h-3.5 w-3.5" />
              {cfg.label}
            </span>
            <span className="text-xs text-slate-400">{post.publishedBy || "Unknown"} · {formatDate(post.publishedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {editing ? (
            <>
              <button onClick={cancelEdit} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
                <X className="h-4 w-4" /> Cancel
              </button>
              <button onClick={saveEdit} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                <Save className="h-4 w-4" /> Save
              </button>
            </>
          ) : (
            <>
              <button onClick={onBack} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
                <Home className="h-4 w-4" /> Back
              </button>
              {canEdit && (
                <button onClick={startEdit} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="rounded-lg border border-line bg-white p-6 shadow-soft">
        {current.length === 0 && !editing && (
          <p className="py-12 text-center text-sm text-slate-400">
            No content yet.{canEdit && " Click Edit to add widgets."}
          </p>
        )}

        {editing && <AddWidgetBar onAdd={(w) => insertWidget(w, -1)} />}

        {current.map((widget, idx) => (
          <div key={widget.id}>
            <div className={`group relative ${editing ? "rounded-lg border border-dashed border-transparent hover:border-slate-200" : ""}`}>
              {editing && (
                <button
                  onClick={() => deleteWidget(widget.id)}
                  className="absolute -right-2 -top-2 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-slate-400 shadow-sm hover:text-red-500 group-hover:flex"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              <div className={editing ? "p-3" : "py-3"}>
                {widget.type === "text" && !editing && <TextWidgetView w={widget} />}
                {widget.type === "text" && editing && (
                  <TextWidgetEditor widget={widget} onChange={updateWidget} />
                )}

                {widget.type === "callout" && !editing && <CalloutView w={widget} />}
                {widget.type === "callout" && editing && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {(["info", "warning", "success"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => updateWidget({ ...widget, variant: v })}
                          className={`rounded-lg border px-3 py-1 text-xs font-semibold ${widget.variant === v ? "border-brand bg-teal-50 text-brand" : "border-line text-slate-500 hover:bg-panel"}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={widget.content}
                      onChange={(e) => updateWidget({ ...widget, content: e.target.value })}
                      rows={2}
                      placeholder="Callout message…"
                      className="focus-ring w-full rounded-lg border border-line px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {widget.type === "image" && !editing && (
                  widget.src
                    ? <figure className="space-y-2"><img src={widget.src} alt={widget.caption} className="rounded-lg border border-line" />{widget.caption && <figcaption className="text-center text-xs text-slate-400">{widget.caption}</figcaption>}</figure>
                    : <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400"><ImageIcon className="mr-2 h-5 w-5" />No image uploaded</div>
                )}
                {widget.type === "image" && editing && (
                  <div className="space-y-2">
                    {widget.src && (
                      <figure className="space-y-2">
                        <img src={widget.src} alt={widget.caption} className="max-h-80 rounded-lg border border-line object-contain" />
                      </figure>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageSelected(widget, e)}
                      className="focus-ring w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                    />
                    <input value={widget.caption} onChange={(e) => updateWidget({ ...widget, caption: e.target.value })} placeholder="Caption (optional)" className="focus-ring h-9 w-full rounded-lg border border-line px-3 text-sm" />
                  </div>
                )}

                {widget.type === "pdf" && !editing && (
                  <div className="flex items-center gap-3 rounded-lg border border-line bg-panel p-4">
                    <FileText className="h-8 w-8 shrink-0 text-orange-500" />
                    <div>
                      <p className="font-semibold text-ink">{widget.filename || "PDF document"}</p>
                      <p className="text-xs text-slate-400">PDF attachment</p>
                    </div>
                  </div>
                )}
                {widget.type === "pdf" && editing && (
                  <div className="space-y-2">
                    <input type="file" accept="application/pdf" className="focus-ring w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
                    <input value={widget.filename} onChange={(e) => updateWidget({ ...widget, filename: e.target.value })} placeholder="Display name (optional)" className="focus-ring h-9 w-full rounded-lg border border-line px-3 text-sm" />
                  </div>
                )}

                {widget.type === "divider" && <hr className="border-line" />}
              </div>
            </div>

            {editing && <AddWidgetBar onAdd={(w) => insertWidget(w, idx)} />}
          </div>
        ))}

        {editing && current.length > 0 && (
          <p className="pt-2 text-center text-xs text-slate-400">Click + to add a widget · Hover a widget to delete it</p>
        )}
      </div>
    </div>
  );
}
