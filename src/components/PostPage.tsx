"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type CSSProperties, type ReactNode } from "react";
import {
  AlertTriangle,
  Bold,
  BookOpen,
  ChevronRight,
  Check,
  Clipboard,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Home,
  Image as ImageIcon,
  Info,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Palette,
  PenLine,
  Pencil,
  Plus,
  Save,
  Share2,
  Table2,
  Trash2,
  Type,
  Underline,
  X
} from "lucide-react";
import { type MockPost } from "@/lib/mock-data";
import { type UserRole } from "@/lib/auth";
import { derivePostType } from "@/lib/post-content";
import { createClient } from "@/lib/supabase/client";
import { type VisibilityGroup, type VisibilityRule } from "@/lib/visibility";
import VisibilityEditor from "@/components/VisibilityEditor";
import { createPostShare } from "@/app/(app)/knowledge-base/actions";

// ── Widget types ────────────────────────────────────────────────────────────

type TextWidget = {
  id: string;
  type: "text";
  content: string;
  richLines?: RichTextLine[];
  fontSize?: string;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};
type RichTextLine = {
  id: string;
  text: string;
  fontSize?: string;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  listType?: "bullet" | "numbered";
};
type ImageWidget   = { id: string; type: "image";   src: string; caption: string; storagePath?: string };
type PdfWidget     = { id: string; type: "pdf";     filename: string };
type CalloutWidget = {
  id: string;
  type: "callout";
  variant: "info" | "warning" | "success";
  content: string;
  color?: string;
  icon?: string;
};
type CodeWidget    = { id: string; type: "code"; language: string; filename?: string; content: string };
type ChecklistSubpoint = { id: string; text: string; checked: boolean };
type ChecklistItem = { id: string; text: string; checked: boolean; subpoints?: ChecklistSubpoint[] };
type ChecklistWidget = { id: string; type: "checklist"; title?: string; items: ChecklistItem[] };
type StepSubpoint = { id: string; text: string };
type StepItem = { id: string; text: string; subpoints?: StepSubpoint[] };
type StepsWidget = { id: string; type: "steps"; title?: string; steps: StepItem[] };
type TableWidget = { id: string; type: "table"; title?: string; columns: string[]; rows: string[][] };
type QuoteWidget = { id: string; type: "quote"; content: string; source?: string };
type LinkWidget = { id: string; type: "link"; label: string; url: string; description?: string };
type DividerWidget = { id: string; type: "divider" };

type Widget =
  | TextWidget
  | ImageWidget
  | PdfWidget
  | CalloutWidget
  | CodeWidget
  | ChecklistWidget
  | StepsWidget
  | TableWidget
  | QuoteWidget
  | LinkWidget
  | DividerWidget;

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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function parsePastedListItems(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*]\s+\[[ x]\]\s+/i, "")
        .replace(/^[-*•]\s+/, "")
        .replace(/^\d+[\).]\s+/, "")
        .replace(/^[a-z][\).]\s+/i, "")
        .trim()
    )
    .filter(Boolean);
}

function parsePastedTable(text: string) {
  const rows = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));

  return rows;
}

// ── Widget picker ────────────────────────────────────────────────────────────

const widgetTypes = [
  { type: "text"    as const, label: "Text",    icon: PenLine      },
  { type: "image"   as const, label: "Image",   icon: ImageIcon    },
  { type: "pdf"     as const, label: "PDF",     icon: FileText, disabled: true, title: "PDF attachments will be re-added in future when more database storage is added." },
  { type: "callout" as const, label: "Callout", icon: Info         },
  { type: "code"    as const, label: "Code",    icon: Code2        },
  { type: "steps"   as const, label: "Steps",   icon: ListOrdered  },
  { type: "checklist" as const, label: "Checklist", icon: ListChecks },
  { type: "table"   as const, label: "Table",   icon: Table2       },
  { type: "quote"   as const, label: "Quote",   icon: BookOpen     },
  { type: "link"    as const, label: "Link",    icon: ExternalLink },
  { type: "divider" as const, label: "Divider", icon: Minus        },
];

function blankWidget(type: Widget["type"]): Widget {
  switch (type) {
    case "text":    return { id: newId(), type: "text", content: "", fontSize: "16px", fontFamily: "Inter, system-ui, sans-serif", color: "#334155" };
    case "image":   return { id: newId(), type: "image", src: "", caption: "" };
    case "pdf":     return { id: newId(), type: "pdf", filename: "" };
    case "callout": return { id: newId(), type: "callout", variant: "info", content: "", color: "#2563eb", icon: "info" };
    case "code":    return { id: newId(), type: "code", language: "PowerShell", filename: "", content: "" };
    case "steps":   return { id: newId(), type: "steps", title: "", steps: [{ id: newId(), text: "" }] };
    case "checklist": return { id: newId(), type: "checklist", title: "", items: [{ id: newId(), text: "", checked: false }] };
    case "table":   return { id: newId(), type: "table", title: "", columns: ["Item", "Details"], rows: [["", ""]] };
    case "quote":   return { id: newId(), type: "quote", content: "", source: "" };
    case "link":    return { id: newId(), type: "link", label: "", url: "", description: "" };
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
        <div className="absolute top-9 z-20 grid grid-cols-3 gap-1 rounded-lg border border-line bg-white p-1 shadow-soft sm:flex">
          {widgetTypes.map(({ type, label, icon: Icon, disabled, title }) => (
            <button
              key={type}
              type="button"
              disabled={disabled}
              title={title}
              onClick={() => { if (!disabled) { onAdd(blankWidget(type)); setOpen(false); } }}
              className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold ${disabled ? "cursor-not-allowed text-slate-300" : "text-slate-600 hover:bg-mist"}`}
            >
              <Icon className={`h-4 w-4 ${disabled ? "text-slate-300" : "text-slate-500"}`} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Individual widget renderers ──────────────────────────────────────────────

const AUTO_LINK_TLDS = [
  "com", "org", "net", "edu", "gov", "mil", "co", "info", "biz",
  "io", "ai", "app", "dev", "cloud", "tech", "support", "help",
  "nz", "au", "us", "uk", "eu", "ie", "de", "fr", "it", "es",
  "nl", "be", "ch", "se", "no", "dk", "fi", "pl", "at"
];

const AUTO_LINK_PATTERN = new RegExp(
  `(^|[^\\w@])((?:https?:\\/\\/)?(?:www\\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${AUTO_LINK_TLDS.join("|")})(?::\\d{2,5})?(?:\\/[^\\s<>()]*)?)`,
  "gi"
);

const codeLanguages = [
  "Plain text",
  "PowerShell",
  "Command Prompt",
  "Bash",
  "SQL",
  "JSON",
  "XML",
  "YAML",
  "JavaScript",
  "TypeScript",
  "HTML",
  "CSS",
  "PHP",
  "Python",
  "C#",
  "Markdown"
];

type HighlightRule = { pattern: RegExp; className: string };

const tokenStyles = {
  comment: "text-slate-500",
  string: "text-emerald-300",
  number: "text-amber-300",
  keyword: "text-sky-300",
  variable: "text-violet-300",
  property: "text-cyan-300",
  function: "text-yellow-200",
  operator: "text-rose-300",
  tag: "text-pink-300",
  attr: "text-lime-300"
};

function wordsPattern(words: string[]) {
  return new RegExp(`\\b(?:${words.join("|")})\\b`);
}

function getHighlightRules(language: string): HighlightRule[] {
  const lang = language.toLowerCase();
  const commonStrings = [
    { pattern: /"(?:\\.|[^"\\])*"/, className: tokenStyles.string },
    { pattern: /'(?:\\.|[^'\\])*'/, className: tokenStyles.string }
  ];
  const commonNumbers = [{ pattern: /\b\d+(?:\.\d+)?\b/, className: tokenStyles.number }];

  if (lang.includes("powershell")) {
    return [
      { pattern: /#.*/, className: tokenStyles.comment },
      { pattern: /\$[A-Za-z_][\w:]*/, className: tokenStyles.variable },
      { pattern: /\b(?:Get|Set|New|Remove|Add|Clear|Start|Stop|Restart|Test|Invoke|Import|Export|Connect|Disconnect)-[A-Za-z]+\b/, className: tokenStyles.function },
      { pattern: wordsPattern(["if", "else", "elseif", "foreach", "for", "while", "switch", "param", "function", "return", "try", "catch", "finally", "true", "false", "null"]), className: tokenStyles.keyword },
      ...commonStrings,
      ...commonNumbers,
      { pattern: /-[A-Za-z][\w-]*/, className: tokenStyles.operator }
    ];
  }

  if (lang.includes("bash")) {
    return [
      { pattern: /#.*/, className: tokenStyles.comment },
      { pattern: /\$[A-Za-z_][\w]*/, className: tokenStyles.variable },
      { pattern: wordsPattern(["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "echo", "sudo", "export", "return", "exit"]), className: tokenStyles.keyword },
      ...commonStrings,
      ...commonNumbers,
      { pattern: /--?[A-Za-z][\w-]*/, className: tokenStyles.operator }
    ];
  }

  if (lang.includes("command")) {
    return [
      { pattern: /rem .*/i, className: tokenStyles.comment },
      { pattern: /%[A-Za-z_][\w]*%/, className: tokenStyles.variable },
      { pattern: wordsPattern(["echo", "set", "if", "else", "for", "in", "do", "call", "exit", "copy", "xcopy", "robocopy", "mkdir", "rmdir", "del", "net", "ipconfig", "ping"]), className: tokenStyles.keyword },
      ...commonStrings,
      ...commonNumbers
    ];
  }

  if (lang === "sql") {
    return [
      { pattern: /--.*/, className: tokenStyles.comment },
      { pattern: /\/\*[\s\S]*?\*\//, className: tokenStyles.comment },
      ...commonStrings,
      { pattern: wordsPattern(["select", "from", "where", "join", "inner", "left", "right", "full", "outer", "on", "insert", "into", "update", "delete", "create", "alter", "drop", "table", "view", "index", "and", "or", "not", "null", "is", "like", "in", "exists", "group", "by", "order", "having", "limit", "offset", "values", "set", "as", "distinct", "case", "when", "then", "else", "end"]), className: tokenStyles.keyword },
      ...commonNumbers
    ];
  }

  if (lang === "json") {
    return [
      { pattern: /"(?:\\.|[^"\\])*"(?=\s*:)/, className: tokenStyles.property },
      { pattern: /"(?:\\.|[^"\\])*"/, className: tokenStyles.string },
      { pattern: /\b(?:true|false|null)\b/, className: tokenStyles.keyword },
      ...commonNumbers
    ];
  }

  if (["javascript", "typescript", "c#"].includes(lang)) {
    return [
      { pattern: /\/\/.*/, className: tokenStyles.comment },
      { pattern: /\/\*[\s\S]*?\*\//, className: tokenStyles.comment },
      ...commonStrings,
      { pattern: /`(?:\\.|[^`\\])*`/, className: tokenStyles.string },
      { pattern: wordsPattern(["const", "let", "var", "function", "return", "if", "else", "for", "while", "switch", "case", "break", "continue", "class", "extends", "import", "from", "export", "async", "await", "try", "catch", "finally", "new", "public", "private", "protected", "static", "void", "string", "number", "boolean", "true", "false", "null", "undefined"]), className: tokenStyles.keyword },
      { pattern: /\b[A-Za-z_]\w*(?=\s*\()/, className: tokenStyles.function },
      ...commonNumbers
    ];
  }

  if (["python", "php"].includes(lang)) {
    return [
      { pattern: /#.*/, className: tokenStyles.comment },
      { pattern: /\/\/.*/, className: tokenStyles.comment },
      ...commonStrings,
      { pattern: /\$[A-Za-z_]\w*/, className: tokenStyles.variable },
      { pattern: wordsPattern(["def", "class", "return", "if", "elif", "else", "for", "while", "try", "except", "finally", "import", "from", "as", "with", "lambda", "function", "echo", "public", "private", "protected", "true", "false", "null", "None", "True", "False"]), className: tokenStyles.keyword },
      { pattern: /\b[A-Za-z_]\w*(?=\s*\()/, className: tokenStyles.function },
      ...commonNumbers
    ];
  }

  if (["html", "xml"].includes(lang)) {
    return [
      { pattern: /<!--[\s\S]*?-->/, className: tokenStyles.comment },
      { pattern: /<\/?[A-Za-z][^>\s/]*/, className: tokenStyles.tag },
      { pattern: /\s[A-Za-z_:][-A-Za-z0-9_:.]*(?=\=)/, className: tokenStyles.attr },
      ...commonStrings
    ];
  }

  if (lang === "css") {
    return [
      { pattern: /\/\*[\s\S]*?\*\//, className: tokenStyles.comment },
      { pattern: /[.#]?[A-Za-z_-][\w-]*(?=\s*\{)/, className: tokenStyles.tag },
      { pattern: /[A-Za-z-]+(?=\s*:)/, className: tokenStyles.property },
      ...commonStrings,
      { pattern: /#[0-9a-fA-F]{3,8}\b/, className: tokenStyles.number },
      { pattern: /\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms)?\b/, className: tokenStyles.number }
    ];
  }

  if (lang === "yaml") {
    return [
      { pattern: /#.*/, className: tokenStyles.comment },
      { pattern: /^[\t ]*[A-Za-z0-9_-]+(?=\s*:)/, className: tokenStyles.property },
      ...commonStrings,
      ...commonNumbers,
      { pattern: /\b(?:true|false|null|yes|no)\b/, className: tokenStyles.keyword }
    ];
  }

  if (lang === "markdown") {
    return [
      { pattern: /^#{1,6}\s.*/, className: tokenStyles.keyword },
      { pattern: /`[^`]+`/, className: tokenStyles.string },
      { pattern: /\*\*[^*]+\*\*/, className: tokenStyles.function },
      { pattern: /\[[^\]]+\]\([^)]+\)/, className: tokenStyles.property }
    ];
  }

  return [...commonStrings, ...commonNumbers];
}

function highlightCode(code: string, language: string): ReactNode[] {
  const rules = getHighlightRules(language);
  const nodes: ReactNode[] = [];
  let buffer = "";
  let cursor = 0;

  while (cursor < code.length) {
    const rest = code.slice(cursor);
    const matched = rules
      .map((rule) => ({ rule, match: rest.match(new RegExp(`^(?:${rule.pattern.source})`, rule.pattern.flags.replace("g", ""))) }))
      .find(({ match }) => match?.[0]);

    if (!matched?.match) {
      buffer += code[cursor];
      cursor += 1;
      continue;
    }

    if (buffer) {
      nodes.push(buffer);
      buffer = "";
    }

    const value = matched.match[0];
    nodes.push(<span key={`${cursor}-${nodes.length}`} className={matched.rule.className}>{value}</span>);
    cursor += value.length;
  }

  if (buffer) nodes.push(buffer);
  return nodes;
}

function TextWidgetView({ w }: { w: TextWidget }) {
  const content = typeof w.content === "string" ? w.content : "";
  const richLines = Array.isArray(w.richLines)
    ? w.richLines.filter((line): line is RichTextLine => Boolean(line) && typeof line === "object")
    : [];
  const baseTextStyle: CSSProperties = {
    color: w.color ?? "#334155",
    fontFamily: w.fontFamily ?? "Inter, system-ui, sans-serif",
    fontSize: w.fontSize ?? "16px",
    fontWeight: w.bold ? 700 : 400,
    fontStyle: w.italic ? "italic" : "normal",
    textDecoration: w.underline ? "underline" : "none"
  };

  function lineStyle(line?: Partial<RichTextLine>): CSSProperties {
    return {
      color: line?.color ?? baseTextStyle.color,
      fontFamily: line?.fontFamily ?? baseTextStyle.fontFamily,
      fontSize: line?.fontSize ?? baseTextStyle.fontSize,
      fontWeight: (line?.bold ?? w.bold) ? 700 : 400,
      fontStyle: (line?.italic ?? w.italic) ? "italic" : "normal",
      textDecoration: (line?.underline ?? w.underline) ? "underline" : "none"
    };
  }

  function renderLinks(text: string, keyPrefix: string): ReactNode[] {
    const safeText = String(text ?? "");
    const nodes: ReactNode[] = [];
    const trailingPunctuation = /[.,!?;:]+$/;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    AUTO_LINK_PATTERN.lastIndex = 0;
    while ((match = AUTO_LINK_PATTERN.exec(safeText)) !== null) {
      const prefix = match[1];
      const rawUrl = match[2];
      const urlStart = match.index + prefix.length;
      const punctuation = rawUrl.match(trailingPunctuation)?.[0] ?? "";
      const label = punctuation ? rawUrl.slice(0, -punctuation.length) : rawUrl;
      const href = /^https?:\/\//i.test(label) ? label : `https://${label}`;

      if (urlStart > lastIndex) nodes.push(safeText.slice(lastIndex, urlStart));
      nodes.push(
        <a
          key={`${keyPrefix}-${urlStart}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-brand underline underline-offset-2 hover:text-teal-800"
        >
          {label}
        </a>
      );
      if (punctuation) nodes.push(punctuation);

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < safeText.length) nodes.push(safeText.slice(lastIndex));

    return nodes.length ? nodes : [safeText];
  }

  function renderInlineContent(text: string): ReactNode[] {
    return String(text ?? "").split(/(\*\*.*?\*\*)/g).flatMap((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{renderLinks(part.slice(2, -2), `bold-${index}`)}</strong>;
      }

      return renderLinks(part, `plain-${index}`);
    });
  }

  function renderRichLineBlocks(lines: RichTextLine[]) {
    const blocks: ReactNode[] = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      const lineText = typeof line.text === "string" ? line.text : "";

      if (!lineText && !line.listType) {
        blocks.push(<br key={line.id ?? index} />);
        index += 1;
        continue;
      }

      if (line.listType === "bullet" || line.listType === "numbered") {
        const listStart = index;
        const listType = line.listType;
        const items: ReactNode[] = [];

        while (index < lines.length && lines[index].listType === listType) {
          const currentLine = lines[index];
          items.push(
            <li key={currentLine.id ?? index} style={lineStyle(currentLine)}>
              {renderInlineContent(currentLine.text ?? "")}
            </li>
          );
          index += 1;
        }

        const ListTag = listType === "numbered" ? "ol" : "ul";
        blocks.push(
          <ListTag key={lines[listStart].id ?? listStart} className={`ml-5 space-y-1 ${listType === "numbered" ? "list-decimal" : "list-disc"}`}>
            {items}
          </ListTag>
        );
        continue;
      }

      blocks.push(
        <p key={line.id ?? index} style={lineStyle(line)}>
          {renderInlineContent(lineText)}
        </p>
      );
      index += 1;
    }

    return blocks;
  }

  if (richLines.length) {
    return (
      <div className="prose prose-sm max-w-none" style={baseTextStyle}>
        {renderRichLineBlocks(richLines)}
      </div>
    );
  }

  const blocks: ReactNode[] = [];
  const lines = content.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line === "") {
      blocks.push(<br key={index} />);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(<h2 key={index} className="text-lg font-bold" style={baseTextStyle}>{line.slice(3)}</h2>);
      index += 1;
      continue;
    }

    if (line.startsWith("**") && line.endsWith("**")) {
      blocks.push(<p key={index} className="font-semibold" style={baseTextStyle}>{renderInlineContent(line)}</p>);
      index += 1;
      continue;
    }

    if (line.startsWith("- [ ]")) {
      const items: ReactNode[] = [];
      const listStart = index;

      while (index < lines.length && lines[index].startsWith("- [ ]")) {
        items.push(
          <li key={index} className="list-none text-slate-600">
            <span aria-hidden="true">[ ]</span> {renderInlineContent(lines[index].slice(5).trimStart())}
          </li>
        );
        index += 1;
      }

      blocks.push(<ul key={listStart} className="ml-4 space-y-1">{items}</ul>);
      continue;
    }

    if (line.startsWith("- ")) {
      const items: ReactNode[] = [];
      const listStart = index;

      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(<li key={index}>{renderInlineContent(lines[index].slice(2))}</li>);
        index += 1;
      }

      blocks.push(<ul key={listStart} className="ml-5 list-disc space-y-1" style={baseTextStyle}>{items}</ul>);
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: ReactNode[] = [];
      const listStart = index;

      while (index < lines.length && /^\d+\.\s/.test(lines[index])) {
        items.push(<li key={index}>{renderInlineContent(lines[index].replace(/^\d+\.\s*/, ""))}</li>);
        index += 1;
      }

      blocks.push(<ol key={listStart} className="ml-5 list-decimal space-y-1" style={baseTextStyle}>{items}</ol>);
      continue;
    }

    blocks.push(<p key={index} style={baseTextStyle}>{renderInlineContent(line)}</p>);
    index += 1;
  }

  return (
    <div className="prose prose-sm max-w-none" style={baseTextStyle}>
      {blocks}
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function update(patch: Partial<TextWidget>) {
    onChange({ ...widget, ...patch });
  }

  function getRichLines(): RichTextLine[] {
    const widgetContent = typeof widget.content === "string" ? widget.content : "";
    const textLines = widgetContent.split("\n");
    const existing = Array.isArray(widget.richLines) ? widget.richLines : [];

    return textLines.map((text, index) => {
      const current = existing[index];
      if (current && typeof current === "object") return { ...current, id: current.id ?? newId(), text };

      const numberedMatch = text.match(/^\d+\.\s+(.*)$/);
      if (text.startsWith("## ")) {
        return {
          id: newId(),
          text: text.slice(3),
          fontSize: "20px",
          fontFamily: widget.fontFamily,
          color: widget.color,
          bold: true,
          italic: widget.italic,
          underline: widget.underline
        };
      }
      if (text.startsWith("- ")) {
        return {
          id: newId(),
          text: text.slice(2),
          fontSize: widget.fontSize,
          fontFamily: widget.fontFamily,
          color: widget.color,
          bold: widget.bold,
          italic: widget.italic,
          underline: widget.underline,
          listType: "bullet"
        };
      }
      if (numberedMatch) {
        return {
          id: newId(),
          text: numberedMatch[1],
          fontSize: widget.fontSize,
          fontFamily: widget.fontFamily,
          color: widget.color,
          bold: widget.bold,
          italic: widget.italic,
          underline: widget.underline,
          listType: "numbered"
        };
      }
      if (text.startsWith("**") && text.endsWith("**")) {
        return {
          id: newId(),
          text: text.slice(2, -2),
          fontSize: widget.fontSize,
          fontFamily: widget.fontFamily,
          color: widget.color,
          bold: true,
          italic: widget.italic,
          underline: widget.underline
        };
      }

      return {
        id: newId(),
        text,
        fontSize: widget.fontSize,
        fontFamily: widget.fontFamily,
        color: widget.color,
        bold: widget.bold,
        italic: widget.italic,
        underline: widget.underline
      };
    });
  }

  function getSelectedLineRange() {
    const textarea = textareaRef.current;
    const content = typeof widget.content === "string" ? widget.content : "";
    if (!textarea) return { start: 0, end: Math.max(0, content.split("\n").length - 1) };

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const start = content.slice(0, selectionStart).split("\n").length - 1;
    const end = content.slice(0, Math.max(selectionStart, selectionEnd - 1)).split("\n").length - 1;

    return { start, end };
  }

  function updateContent(content: string) {
    const previous = getRichLines();
    const lines = content.split("\n");
    update({
      content,
      richLines: lines.map((text, index) => ({
        ...(previous[index] ?? { id: newId() }),
        text
      }))
    });
  }

  function updateSelectedLines(updater: (line: RichTextLine, index: number) => RichTextLine) {
    const { start, end } = getSelectedLineRange();
    const richLines = getRichLines().map((line, index) =>
      index >= start && index <= end ? updater(line, index - start) : line
    );
    update({
      content: richLines.map((line) => line.text).join("\n"),
      richLines
    });
  }

  function toggleSelectedList(listType: RichTextLine["listType"]) {
    updateSelectedLines((line) => ({
      ...line,
      listType: line.listType === listType ? undefined : listType
    }));
  }

  function applySelectedStyle(patch: Partial<RichTextLine>) {
    updateSelectedLines((line) => ({ ...line, ...patch }));
  }

  const inactiveButton = "border-line bg-white text-slate-600 hover:bg-mist";
  const richPreviewWidget = { ...widget, richLines: getRichLines() };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel p-2">
        <label className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-white px-2 text-xs font-semibold text-slate-600">
          <Type className="h-3.5 w-3.5" />
          <select
            value={widget.fontFamily ?? "Inter, system-ui, sans-serif"}
            onChange={(e) => applySelectedStyle({ fontFamily: e.target.value })}
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
          onChange={(e) => applySelectedStyle({ fontSize: e.target.value })}
          className="focus-ring h-8 rounded-lg border border-line bg-white px-2 text-xs font-semibold text-slate-600"
        >
          <option value="13px">Small</option>
          <option value="16px">Normal</option>
          <option value="20px">Large</option>
          <option value="26px">Heading</option>
          <option value="32px">Title</option>
        </select>

        <button type="button" title="Bold" onClick={() => updateSelectedLines((line) => ({ ...line, bold: !line.bold }))} className={`focus-ring h-8 w-8 rounded-lg border ${inactiveButton}`}>
          <Bold className="mx-auto h-4 w-4" />
        </button>
        <button type="button" title="Italic" onClick={() => updateSelectedLines((line) => ({ ...line, italic: !line.italic }))} className={`focus-ring h-8 w-8 rounded-lg border ${inactiveButton}`}>
          <Italic className="mx-auto h-4 w-4" />
        </button>
        <button type="button" title="Underline" onClick={() => updateSelectedLines((line) => ({ ...line, underline: !line.underline }))} className={`focus-ring h-8 w-8 rounded-lg border ${inactiveButton}`}>
          <Underline className="mx-auto h-4 w-4" />
        </button>

        <button type="button" title="Bullet list" onClick={() => toggleSelectedList("bullet")} className="focus-ring h-8 w-8 rounded-lg border border-line bg-white text-slate-600 hover:bg-mist">
          <List className="mx-auto h-4 w-4" />
        </button>
        <button type="button" title="Numbered list" onClick={() => toggleSelectedList("numbered")} className="focus-ring h-8 w-8 rounded-lg border border-line bg-white text-slate-600 hover:bg-mist">
          <ListOrdered className="mx-auto h-4 w-4" />
        </button>

        <label title="Text colour" className="flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2 text-slate-600 hover:bg-mist">
          <Palette className="h-4 w-4" />
          <input
            type="color"
            value={widget.color ?? "#334155"}
            onChange={(e) => applySelectedStyle({ color: e.target.value })}
            className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
      </div>

      <textarea
        ref={textareaRef}
        value={widget.content}
        onChange={(e) => updateContent(e.target.value)}
        rows={8}
        placeholder="Write your content here... Select one or more lines before using the toolbar to format only those lines."
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
      <div className="rounded-lg border border-line bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Text preview</p>
        <TextWidgetView w={richPreviewWidget} />
      </div>
    </div>
  );
}

const calloutPresets = {
  info: { label: "Info", color: "#2563eb", icon: "info" },
  warning: { label: "Warning", color: "#d97706", icon: "warning" },
  success: { label: "Success", color: "#0f766e", icon: "success" }
} as const;

const calloutIconOptions = [
  { value: "info", label: "Info", Icon: Info },
  { value: "warning", label: "Warning", Icon: AlertTriangle },
  { value: "success", label: "Check", Icon: Check },
  { value: "book", label: "Book", Icon: BookOpen },
  { value: "code", label: "Code", Icon: Code2 },
  { value: "file", label: "File", Icon: FileText },
  { value: "link", label: "Link", Icon: ExternalLink }
] as const;

const calloutColorOptions = [
  "#2563eb",
  "#d97706",
  "#0f766e",
  "#7c3aed",
  "#be123c",
  "#475569",
  "#15803d",
  "#c2410c"
];

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return { r: 37, g: 99, b: 235 };

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function getCalloutDesign(w: CalloutWidget) {
  const preset = calloutPresets[w.variant];
  const color = w.color || preset.color;
  const rgb = hexToRgb(color);
  const iconOption = calloutIconOptions.find((option) => option.value === (w.icon || preset.icon)) ?? calloutIconOptions[0];

  return {
    color,
    Icon: iconOption.Icon,
    style: {
      backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.09)`,
      borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.32)`,
      color
    } satisfies CSSProperties
  };
}

function CalloutView({ w }: { w: CalloutWidget }) {
  const { Icon, style } = getCalloutDesign(w);

  return (
    <div className="flex gap-3 rounded-lg border p-4" style={style}>
      <span className="mt-0.5 shrink-0">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm leading-6">{w.content}</p>
    </div>
  );
}

function CalloutWidgetEditor({
  widget,
  onChange
}: {
  widget: CalloutWidget;
  onChange: (widget: CalloutWidget) => void;
}) {
  function update(patch: Partial<CalloutWidget>) {
    onChange({ ...widget, ...patch });
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-panel p-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries(calloutPresets).map(([variant, preset]) => (
          <button
            key={variant}
            type="button"
            onClick={() => update({ variant: variant as CalloutWidget["variant"], color: preset.color, icon: preset.icon })}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold ${widget.variant === variant ? "border-brand bg-teal-50 text-brand" : "border-line bg-white text-slate-500 hover:bg-mist"}`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Icon</span>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calloutIconOptions.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                title={label}
                onClick={() => update({ icon: value })}
                className={`focus-ring flex h-9 items-center justify-center rounded-lg border ${widget.icon === value ? "border-brand bg-teal-50 text-brand" : "border-line bg-white text-slate-500 hover:bg-mist"}`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colour</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {calloutColorOptions.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => update({ color })}
                className={`h-8 w-8 rounded-full border-2 transition ${widget.color === color ? "scale-110 border-ink" : "border-transparent hover:scale-105"}`}
                style={{ backgroundColor: color }}
              />
            ))}
            <label className="focus-ring flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white">
              <input
                type="color"
                value={widget.color || calloutPresets[widget.variant].color}
                onChange={(e) => update({ color: e.target.value })}
                className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
          </div>
        </div>
      </div>

      <textarea
        value={widget.content}
        onChange={(e) => update({ content: e.target.value })}
        rows={2}
        placeholder="Callout message..."
        className="focus-ring w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
      />

      <CalloutView w={widget} />
    </div>
  );
}

// ── Main PostPage component ──────────────────────────────────────────────────

function CodeWidgetView({ w }: { w: CodeWidget }) {
  const [copied, setCopied] = useState(false);
  const language = w.language || "Plain text";
  const code = w.content || "";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-300">{language}</p>
          {w.filename && <p className="truncate text-xs text-slate-500">{w.filename}</p>}
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-700 px-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto p-4 text-sm leading-6 text-slate-100">
        <code className="font-mono">{highlightCode(code || "// Add code here", language)}</code>
      </pre>
    </div>
  );
}

function CodeWidgetEditor({
  widget,
  onChange
}: {
  widget: CodeWidget;
  onChange: (widget: CodeWidget) => void;
}) {
  function update(patch: Partial<CodeWidget>) {
    onChange({ ...widget, ...patch });
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-panel p-3">
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Language</span>
          <select
            value={widget.language || "Plain text"}
            onChange={(e) => update({ language: e.target.value })}
            className="focus-ring mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm"
          >
            {codeLanguages.map((language) => (
              <option key={language} value={language}>{language}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filename</span>
          <input
            value={widget.filename ?? ""}
            onChange={(e) => update({ filename: e.target.value })}
            placeholder="Optional, e.g. reset-password.ps1"
            className="focus-ring mt-2 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm"
          />
        </label>
      </div>
      <textarea
        value={widget.content}
        onChange={(e) => update({ content: e.target.value })}
        rows={10}
        spellCheck={false}
        placeholder="Paste or write code here..."
        className="focus-ring w-full rounded-lg border border-line bg-slate-950 px-3 py-3 font-mono text-sm leading-6 text-slate-100"
      />
    </div>
  );
}

function ChecklistWidgetView({ w }: { w: ChecklistWidget }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      {w.title && <h3 className="mb-3 text-sm font-bold text-ink">{w.title}</h3>}
      <ul className="space-y-2">
        {w.items.map((item) => (
          <li key={item.id} className="text-sm text-slate-700">
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${item.checked ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-transparent"}`}>
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className={item.checked ? "text-slate-500" : ""}>{item.text || "Checklist item"}</span>
            </div>
            {(item.subpoints?.length ?? 0) > 0 && (
              <ul className="ml-10 mt-2 space-y-1">
                {item.subpoints?.map((subpoint) => (
                  <li key={subpoint.id}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${subpoint.checked ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-transparent"}`}>
                        <Check className="h-3 w-3" />
                      </span>
                      <span className={subpoint.checked ? "text-slate-500" : ""}>{subpoint.text || "Sub-point"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepsWidgetView({ w }: { w: StepsWidget }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      {w.title && <h3 className="mb-3 text-sm font-bold text-ink">{w.title}</h3>}
      <ol className="space-y-3">
        {w.steps.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm leading-6 text-slate-700">{step.text || "Step instructions"}</p>
              {(step.subpoints?.length ?? 0) > 0 && (
                <ol className="mt-2 space-y-2">
                  {step.subpoints?.map((subpoint) => (
                    <li key={subpoint.id} className="flex items-start gap-2">
                      <span className="mt-2 h-3 w-3 shrink-0 rounded-full bg-brand" />
                      <span className="pt-0.5 text-sm leading-5 text-slate-600">{subpoint.text || "Sub-point"}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ChecklistWidgetEditor({
  widget,
  onChange
}: {
  widget: ChecklistWidget;
  onChange: (widget: ChecklistWidget) => void;
}) {
  function update(patch: Partial<ChecklistWidget>) {
    onChange({ ...widget, ...patch });
  }

  function updateItem(itemId: string, patch: Partial<ChecklistWidget["items"][number]>) {
    update({ items: widget.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) });
  }

  function handleItemPaste(e: ClipboardEvent<HTMLInputElement>, itemId: string) {
    const pastedItems = parsePastedListItems(e.clipboardData.getData("text"));
    if (pastedItems.length <= 1) return;
    e.preventDefault();

    const itemIndex = widget.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) return;

    const currentItem = widget.items[itemIndex];
    const replacementItems = pastedItems.map((text, index) => ({
      id: index === 0 ? currentItem.id : newId(),
      text,
      checked: index === 0 ? currentItem.checked : false,
      subpoints: index === 0 ? currentItem.subpoints : undefined
    }));

    update({
      items: [
        ...widget.items.slice(0, itemIndex),
        ...replacementItems,
        ...widget.items.slice(itemIndex + 1)
      ]
    });
  }

  function removeItem(itemId: string) {
    update({ items: widget.items.filter((item) => item.id !== itemId) });
  }

  function addSubpoint(itemId: string) {
    update({
      items: widget.items.map((item) =>
        item.id === itemId
          ? { ...item, subpoints: [...(item.subpoints ?? []), { id: newId(), text: "", checked: false }] }
          : item
      )
    });
  }

  function updateSubpoint(itemId: string, subpointId: string, patch: Partial<ChecklistSubpoint>) {
    update({
      items: widget.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              subpoints: (item.subpoints ?? []).map((subpoint) =>
                subpoint.id === subpointId ? { ...subpoint, ...patch } : subpoint
              )
            }
          : item
      )
    });
  }

  function removeSubpoint(itemId: string, subpointId: string) {
    update({
      items: widget.items.map((item) =>
        item.id === itemId
          ? { ...item, subpoints: (item.subpoints ?? []).filter((subpoint) => subpoint.id !== subpointId) }
          : item
      )
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-panel p-3">
      <input
        value={widget.title ?? ""}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Checklist title (optional)"
        className="focus-ring h-10 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold"
      />
      <div className="space-y-2">
        {widget.items.map((item) => (
          <div key={item.id} className="space-y-2 rounded-lg border border-line bg-white/60 p-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => updateItem(item.id, { checked: e.target.checked })}
                className="h-4 w-4 rounded border-line"
              />
              <input
                value={item.text}
                onChange={(e) => updateItem(item.id, { text: e.target.value })}
                onPaste={(e) => handleItemPaste(e, item.id)}
                placeholder="Checklist item"
                className="focus-ring h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm"
              />
              <button type="button" onClick={() => removeItem(item.id)} className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            {(item.subpoints ?? []).map((subpoint) => (
              <div key={subpoint.id} className="ml-6 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={subpoint.checked}
                  onChange={(e) => updateSubpoint(item.id, subpoint.id, { checked: e.target.checked })}
                  className="h-4 w-4 rounded border-line"
                />
                <input
                  value={subpoint.text}
                  onChange={(e) => updateSubpoint(item.id, subpoint.id, { text: e.target.value })}
                  placeholder="Sub-point"
                  className="focus-ring h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm"
                />
                <button type="button" onClick={() => removeSubpoint(item.id, subpoint.id)} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addSubpoint(item.id)}
              className="focus-ring ml-6 inline-flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-mist"
            >
              <Plus className="h-3.5 w-3.5" /> Add sub-point
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => update({ items: [...widget.items, { id: newId(), text: "", checked: false }] })}
        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-mist"
      >
        <Plus className="h-4 w-4" /> Add item
      </button>
    </div>
  );
}

function StepsWidgetEditor({
  widget,
  onChange
}: {
  widget: StepsWidget;
  onChange: (widget: StepsWidget) => void;
}) {
  function update(patch: Partial<StepsWidget>) {
    onChange({ ...widget, ...patch });
  }

  function updateStep(stepId: string, text: string) {
    update({ steps: widget.steps.map((step) => (step.id === stepId ? { ...step, text } : step)) });
  }

  function handleStepPaste(e: ClipboardEvent<HTMLInputElement>, stepId: string) {
    const pastedSteps = parsePastedListItems(e.clipboardData.getData("text"));
    if (pastedSteps.length <= 1) return;
    e.preventDefault();

    const stepIndex = widget.steps.findIndex((step) => step.id === stepId);
    if (stepIndex === -1) return;

    const currentStep = widget.steps[stepIndex];
    const replacementSteps = pastedSteps.map((text, index) => ({
      id: index === 0 ? currentStep.id : newId(),
      text,
      subpoints: index === 0 ? currentStep.subpoints : undefined
    }));

    update({
      steps: [
        ...widget.steps.slice(0, stepIndex),
        ...replacementSteps,
        ...widget.steps.slice(stepIndex + 1)
      ]
    });
  }

  function removeStep(stepId: string) {
    update({ steps: widget.steps.filter((step) => step.id !== stepId) });
  }

  function addSubpoint(stepId: string) {
    update({
      steps: widget.steps.map((step) =>
        step.id === stepId
          ? { ...step, subpoints: [...(step.subpoints ?? []), { id: newId(), text: "" }] }
          : step
      )
    });
  }

  function updateSubpoint(stepId: string, subpointId: string, text: string) {
    update({
      steps: widget.steps.map((step) =>
        step.id === stepId
          ? {
              ...step,
              subpoints: (step.subpoints ?? []).map((subpoint) =>
                subpoint.id === subpointId ? { ...subpoint, text } : subpoint
              )
            }
          : step
      )
    });
  }

  function removeSubpoint(stepId: string, subpointId: string) {
    update({
      steps: widget.steps.map((step) =>
        step.id === stepId
          ? { ...step, subpoints: (step.subpoints ?? []).filter((subpoint) => subpoint.id !== subpointId) }
          : step
      )
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-panel p-3">
      <input
        value={widget.title ?? ""}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Steps title (optional)"
        className="focus-ring h-10 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold"
      />
      <div className="space-y-2">
        {widget.steps.map((step, index) => (
          <div key={step.id} className="space-y-2 rounded-lg border border-line bg-white/60 p-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {index + 1}
              </span>
              <input
                value={step.text}
                onChange={(e) => updateStep(step.id, e.target.value)}
                onPaste={(e) => handleStepPaste(e, step.id)}
                placeholder="Step instructions"
                className="focus-ring h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm"
              />
              <button type="button" onClick={() => removeStep(step.id)} className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            {(step.subpoints ?? []).map((subpoint) => (
              <div key={subpoint.id} className="ml-10 flex items-center gap-2">
                <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-brand" />
                <input
                  value={subpoint.text}
                  onChange={(e) => updateSubpoint(step.id, subpoint.id, e.target.value)}
                  placeholder="Sub-point"
                  className="focus-ring h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm"
                />
                <button type="button" onClick={() => removeSubpoint(step.id, subpoint.id)} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addSubpoint(step.id)}
              className="focus-ring ml-10 inline-flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-mist"
            >
              <Plus className="h-3.5 w-3.5" /> Add sub-point
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => update({ steps: [...widget.steps, { id: newId(), text: "" }] })}
        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-mist"
      >
        <Plus className="h-4 w-4" /> Add step
      </button>
    </div>
  );
}

function normaliseHref(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function TableWidgetView({ w }: { w: TableWidget }) {
  return (
    <div className="space-y-3">
      {w.title && <h3 className="text-sm font-bold text-ink">{w.title}</h3>}
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-panel">
            <tr>
              {w.columns.map((column, index) => (
                <th key={`${column}-${index}`} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  {column || `Column ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {w.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {w.columns.map((_, columnIndex) => (
                  <td key={`${rowIndex}-${columnIndex}`} className="px-3 py-2 align-top text-slate-700">
                    {row[columnIndex] || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableWidgetEditor({
  widget,
  onChange
}: {
  widget: TableWidget;
  onChange: (widget: TableWidget) => void;
}) {
  function update(patch: Partial<TableWidget>) {
    onChange({ ...widget, ...patch });
  }

  function updateColumn(index: number, value: string) {
    update({ columns: widget.columns.map((column, i) => (i === index ? value : column)) });
  }

  function addColumn() {
    update({
      columns: [...widget.columns, `Column ${widget.columns.length + 1}`],
      rows: widget.rows.map((row) => [...row, ""])
    });
  }

  function removeColumn(index: number) {
    if (widget.columns.length <= 1) return;
    update({
      columns: widget.columns.filter((_, i) => i !== index),
      rows: widget.rows.map((row) => row.filter((_, i) => i !== index))
    });
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    update({
      rows: widget.rows.map((row, i) =>
        i === rowIndex ? widget.columns.map((_, j) => (j === columnIndex ? value : row[j] ?? "")) : row
      )
    });
  }

  function handleCellPaste(e: ClipboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) {
    const parsedRows = parsePastedTable(e.clipboardData.getData("text"));
    const pastedRows =
      parsedRows.length === 1 &&
      widget.columns.length > 1 &&
      parsedRows[0].length > widget.columns.length &&
      parsedRows[0].length % widget.columns.length === 0
        ? Array.from({ length: parsedRows[0].length / widget.columns.length }, (_, index) =>
            parsedRows[0].slice(index * widget.columns.length, (index + 1) * widget.columns.length)
          )
        : parsedRows;
    const isTablePaste = pastedRows.length > 1 || (pastedRows[0]?.length ?? 0) > 1;
    if (!isTablePaste) return;
    e.preventDefault();

    const requiredColumnCount = Math.max(
      widget.columns.length,
      columnIndex + Math.max(...pastedRows.map((row) => row.length))
    );
    const nextColumns = Array.from({ length: requiredColumnCount }, (_, index) =>
      widget.columns[index] ?? `Column ${index + 1}`
    );
    const requiredRowCount = Math.max(widget.rows.length, rowIndex + pastedRows.length);
    const nextRows = Array.from({ length: requiredRowCount }, (_, nextRowIndex) =>
      nextColumns.map((_, nextColumnIndex) => widget.rows[nextRowIndex]?.[nextColumnIndex] ?? "")
    );

    pastedRows.forEach((pastedRow, pastedRowIndex) => {
      pastedRow.forEach((cell, pastedColumnIndex) => {
        nextRows[rowIndex + pastedRowIndex][columnIndex + pastedColumnIndex] = cell;
      });
    });

    update({ columns: nextColumns, rows: nextRows });
  }

  function addRow() {
    update({ rows: [...widget.rows, widget.columns.map(() => "")] });
  }

  function removeRow(index: number) {
    update({ rows: widget.rows.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-3 rounded-lg border border-line bg-panel p-3">
      <input
        value={widget.title ?? ""}
        onChange={(e) => update({ title: e.target.value })}
        placeholder="Table title (optional)"
        className="focus-ring h-10 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold"
      />
      <div className="overflow-x-auto">
        <div className="min-w-[520px] space-y-2">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${widget.columns.length}, minmax(120px, 1fr)) 40px` }}>
            {widget.columns.map((column, index) => (
              <div key={index} className="flex gap-1">
                <input
                  value={column}
                  onChange={(e) => updateColumn(index, e.target.value)}
                  placeholder={`Column ${index + 1}`}
                  className="focus-ring h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-xs font-semibold"
                />
                <button type="button" onClick={() => removeColumn(index)} className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={addColumn} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-slate-500 hover:bg-mist">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {widget.rows.map((row, rowIndex) => (
            <div key={rowIndex} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${widget.columns.length}, minmax(120px, 1fr)) 40px` }}>
              {widget.columns.map((_, columnIndex) => (
                <input
                  key={`${rowIndex}-${columnIndex}`}
                  value={row[columnIndex] ?? ""}
                  onChange={(e) => updateCell(rowIndex, columnIndex, e.target.value)}
                  onPaste={(e) => handleCellPaste(e, rowIndex, columnIndex)}
                  placeholder="Cell"
                  className="focus-ring h-9 rounded-lg border border-line bg-white px-2 text-sm"
                />
              ))}
              <button type="button" onClick={() => removeRow(rowIndex)} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
      <button type="button" onClick={addRow} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-mist">
        <Plus className="h-4 w-4" /> Add row
      </button>
    </div>
  );
}

function QuoteWidgetView({ w }: { w: QuoteWidget }) {
  return (
    <blockquote className="rounded-lg border-l-4 border-brand bg-teal-50 px-4 py-3">
      <p className="text-sm leading-6 text-teal-900">{w.content || "Quote text"}</p>
      {w.source && <footer className="mt-2 text-xs font-semibold text-teal-700">{w.source}</footer>}
    </blockquote>
  );
}

function QuoteWidgetEditor({
  widget,
  onChange
}: {
  widget: QuoteWidget;
  onChange: (widget: QuoteWidget) => void;
}) {
  function update(patch: Partial<QuoteWidget>) {
    onChange({ ...widget, ...patch });
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-panel p-3">
      <textarea
        value={widget.content}
        onChange={(e) => update({ content: e.target.value })}
        rows={3}
        placeholder="Quote or important snippet"
        className="focus-ring w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
      />
      <input
        value={widget.source ?? ""}
        onChange={(e) => update({ source: e.target.value })}
        placeholder="Source (optional)"
        className="focus-ring h-10 w-full rounded-lg border border-line bg-white px-3 text-sm"
      />
    </div>
  );
}

function LinkWidgetView({ w }: { w: LinkWidget }) {
  const href = normaliseHref(w.url);

  return (
    <a
      href={href || undefined}
      target="_blank"
      rel="noreferrer"
      className="group flex items-start justify-between gap-3 rounded-lg border border-line bg-panel p-4 hover:border-brand hover:bg-teal-50"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-ink group-hover:text-brand">{w.label || w.url || "Resource link"}</span>
        {w.description && <span className="mt-1 block text-sm leading-5 text-slate-600">{w.description}</span>}
        {w.url && <span className="mt-2 block truncate text-xs font-semibold text-slate-400">{w.url}</span>}
      </span>
      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 group-hover:text-brand" />
    </a>
  );
}

function LinkWidgetEditor({
  widget,
  onChange
}: {
  widget: LinkWidget;
  onChange: (widget: LinkWidget) => void;
}) {
  function update(patch: Partial<LinkWidget>) {
    onChange({ ...widget, ...patch });
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-panel p-3">
      <input
        value={widget.label}
        onChange={(e) => update({ label: e.target.value })}
        placeholder="Link label"
        className="focus-ring h-10 w-full rounded-lg border border-line bg-white px-3 text-sm font-semibold"
      />
      <input
        value={widget.url}
        onChange={(e) => update({ url: e.target.value })}
        placeholder="https://example.com"
        className="focus-ring h-10 w-full rounded-lg border border-line bg-white px-3 text-sm"
      />
      <textarea
        value={widget.description ?? ""}
        onChange={(e) => update({ description: e.target.value })}
        rows={2}
        placeholder="Short description (optional)"
        className="focus-ring w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
      />
    </div>
  );
}

type Props = {
  post: MockPost;
  userRole: UserRole;
  onBack?: () => void;
  categoryTitle: string;
  groups: VisibilityGroup[];
  onSavePost?: (title: string, widgets: Widget[], visibility: VisibilityRule) => void;
  onDeletePost?: () => void | Promise<void>;
  initialEditing?: boolean;
  onInitialEditingConsumed?: () => void;
  sharedView?: boolean;
  shareExpiresAt?: string;
  debugInfo?: Record<string, unknown>;
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

export function PostPage({
  post,
  userRole,
  onBack,
  categoryTitle,
  groups,
  onSavePost,
  onDeletePost,
  initialEditing = false,
  onInitialEditingConsumed,
  sharedView = false,
  shareExpiresAt,
  debugInfo
}: Props) {
  const canEdit = userRole === "super_admin" || userRole === "editor";
  const [editing, setEditing] = useState(initialEditing && canEdit && !sharedView);
  const [title, setTitle] = useState(post.title);
  const [draftTitle, setDraftTitle] = useState(post.title);
  const [widgets, setWidgets] = useState<Widget[]>(post.widgets ?? defaultContent[post.id] ?? []);
  const [draft, setDraft] = useState<Widget[]>(widgets);
  const [visibility, setVisibility] = useState<VisibilityRule>(post.visibility ?? { mode: "everyone", groupIds: [] });
  const [draftVisibility, setDraftVisibility] = useState<VisibilityRule>(visibility);
  const [showShare, setShowShare] = useState(false);
  const [shareDuration, setShareDuration] = useState<"24" | "168" | "forever" | "custom">("24");
  const [customShareValue, setCustomShareValue] = useState("2");
  const [customShareUnit, setCustomShareUnit] = useState<"hours" | "days">("hours");
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharePending, setSharePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (initialEditing && canEdit && !sharedView) onInitialEditingConsumed?.();
  }, [canEdit, initialEditing, onInitialEditingConsumed, sharedView]);

  useEffect(() => {
    if (!shareExpiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [shareExpiresAt]);

  function startEdit() {
    setDraftTitle(title);
    setDraft(widgets);
    setDraftVisibility(visibility);
    setEditing(true);
  }
  function cancelEdit() { setEditing(false); }
  function saveEdit() {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      window.alert("Post title is required.");
      return;
    }

    setTitle(nextTitle);
    setWidgets(draft);
    setVisibility(draftVisibility);
    onSavePost?.(nextTitle, draft, draftVisibility);
    setEditing(false);
  }

  async function deletePost() {
    if (deletePending) return;
    if (!window.confirm(`Delete "${title || "Untitled post"}"? This cannot be undone.`)) return;
    setDeletePending(true);
    try {
      await onDeletePost?.();
    } finally {
      setDeletePending(false);
    }
  }

  function exportPdf() {
    const previousTitle = document.title;
    const filename = `${title || "Knowledge base post"} - ${formatDate(post.publishedAt)}`;
    document.title = filename;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  }

  function getShareHours() {
    if (shareDuration === "forever") return "forever";
    if (shareDuration !== "custom") return Number(shareDuration);
    const value = Math.max(1, Number(customShareValue) || 1);
    return customShareUnit === "days" ? value * 24 : value;
  }

  async function handleCreateShare() {
    setShareError(null);
    setShareUrl("");
    setSharePending(true);
    const result = await createPostShare(post.id, getShareHours());
    setSharePending(false);

    if (!result.ok || !result.token) {
      setShareError(result.error ?? "Share link could not be created.");
      return;
    }

    const url = `${window.location.origin}/share/${result.token}`;
    setShareUrl(url);
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  }

  function formatShareRemaining() {
    if (!shareExpiresAt) return "";
    if (shareExpiresAt.startsWith("9999-12-31")) return "Forever";
    const remaining = Math.max(0, new Date(shareExpiresAt).getTime() - now);
    const totalMinutes = Math.ceil(remaining / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (totalMinutes <= 0) return "Expired";
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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

  async function handleImageSelected(widget: ImageWidget, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      event.target.value = "";
      window.alert("Images must be 5 MB or smaller for now.");
      return;
    }

    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "image";
    const storagePath = `${post.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("knowledgebase-images")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });

    if (error) {
      window.alert(`Image upload failed: ${error.message}`);
      return;
    }

    const { data } = await supabase.storage
      .from("knowledgebase-images")
      .createSignedUrl(storagePath, 60 * 60 * 24);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      updateWidget({
        ...widget,
        src: data?.signedUrl ?? reader.result,
        storagePath,
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
    <div className="post-print-root space-y-6">
      {/* Header */}
      <header className="post-print-header flex flex-col gap-4 rounded-lg border border-line bg-white p-5 shadow-soft md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {sharedView ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-brand">
              <Share2 className="h-4 w-4" />
              <span>Shared post</span>
              {shareExpiresAt && (
                <span className="rounded-md bg-teal-50 px-2 py-1 text-xs text-teal-800">
                  {formatShareRemaining() === "Forever" ? "No expiry" : `Expires in ${formatShareRemaining()}`}
                </span>
              )}
            </div>
          ) : (
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
              <button onClick={() => onBack?.()} className="hover:text-slate-600">Knowledge Base</button>
              <ChevronRight className="h-3 w-3" />
              <span>{categoryTitle}</span>
              <ChevronRight className="h-3 w-3" />
              <span>{post.subcategory}</span>
            </div>
          )}
          {editing ? (
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Post title</span>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3 text-xl font-bold text-ink"
                placeholder="Post title"
              />
            </label>
          ) : (
            <h2 className="text-2xl font-bold text-ink">{title || "Untitled post"}</h2>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${cfg.bg} ${cfg.fg}`}>
              <TypeIcon className="h-3.5 w-3.5" />
              {cfg.label}
            </span>
            <span className="text-xs text-slate-400">{post.publishedBy || "Unknown"} · {formatDate(post.publishedAt)}</span>
          </div>
        </div>
        <div className="print-hidden flex w-full shrink-0 flex-col gap-3 md:w-auto md:max-w-md">
          {editing ? (
            <>
              <div className="rounded-lg border border-line bg-panel p-3">
                <VisibilityEditor
                  label="Post visibility"
                  visibility={draftVisibility}
                  groups={groups}
                  onChange={setDraftVisibility}
                />
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {!sharedView && onDeletePost && (
                  <button onClick={deletePost} disabled={deletePending} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-transparent">
                    <Trash2 className="h-4 w-4" /> {deletePending ? "Deleting..." : "Delete"}
                  </button>
                )}
                <button onClick={cancelEdit} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
                  <X className="h-4 w-4" /> Cancel
                </button>
                <button onClick={saveEdit} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                  <Save className="h-4 w-4" /> Save
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2 md:justify-end">
              {!sharedView && (
                <button onClick={onBack} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
                  <Home className="h-4 w-4" /> Back
                </button>
              )}
              <button onClick={exportPdf} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
                <Download className="h-4 w-4" /> Export PDF
              </button>
              {!sharedView && canEdit && (
                <>
                  <button onClick={() => setShowShare(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                  <button onClick={startEdit} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {!sharedView && debugInfo && (
        <details className="print-hidden rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <summary className="cursor-pointer font-bold">Post debug info</summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white/80 p-3 text-xs">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </details>
      )}

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-soft sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink">Share post</h3>
                <p className="text-sm text-slate-500">Create a view-only link with a chosen access window.</p>
              </div>
              <button type="button" onClick={() => setShowShare(false)} className="focus-ring rounded-lg p-1 hover:bg-panel">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "1 day", value: "24" },
                  { label: "1 week", value: "168" },
                  { label: "Forever", value: "forever" }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setShareDuration(option.value as "24" | "168" | "forever")}
                    className={`focus-ring h-10 rounded-lg border text-sm font-semibold ${shareDuration === option.value ? "border-brand bg-teal-50 text-brand" : "border-line text-slate-600 hover:bg-panel"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button type="button" onClick={() => setShareDuration("custom")} className={`focus-ring h-10 w-full rounded-lg border text-sm font-semibold ${shareDuration === "custom" ? "border-brand bg-teal-50 text-brand" : "border-line text-slate-600 hover:bg-panel"}`}>
                Custom hours / days
              </button>

              {shareDuration === "custom" && (
                <div className="grid grid-cols-[1fr_120px] gap-2">
                  <input type="number" min={1} value={customShareValue} onChange={(e) => setCustomShareValue(e.target.value)} className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                  <select value={customShareUnit} onChange={(e) => setCustomShareUnit(e.target.value as "hours" | "days")} className="focus-ring h-10 rounded-lg border border-line bg-white px-3 text-sm">
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              )}

              <button type="button" onClick={handleCreateShare} disabled={sharePending} className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                <Share2 className="h-4 w-4" />
                {sharePending ? "Creating..." : "Create and copy link"}
              </button>

              {shareError && <p className="text-sm text-red-600">{shareError}</p>}
              {shareUrl && (
                <div className="rounded-lg border border-line bg-panel p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Copied link</p>
                  <p className="mt-1 break-all text-sm font-semibold text-ink">{shareUrl}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="post-print-content rounded-lg border border-line bg-white p-6 shadow-soft">
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
                  <CalloutWidgetEditor widget={widget} onChange={updateWidget} />
                )}

                {widget.type === "code" && !editing && <CodeWidgetView w={widget} />}
                {widget.type === "code" && editing && (
                  <CodeWidgetEditor widget={widget} onChange={updateWidget} />
                )}

                {widget.type === "steps" && !editing && <StepsWidgetView w={widget} />}
                {widget.type === "steps" && editing && (
                  <StepsWidgetEditor widget={widget} onChange={updateWidget} />
                )}

                {widget.type === "checklist" && !editing && <ChecklistWidgetView w={widget} />}
                {widget.type === "checklist" && editing && (
                  <ChecklistWidgetEditor widget={widget} onChange={updateWidget} />
                )}

                {widget.type === "table" && !editing && <TableWidgetView w={widget} />}
                {widget.type === "table" && editing && (
                  <TableWidgetEditor widget={widget} onChange={updateWidget} />
                )}

                {widget.type === "quote" && !editing && <QuoteWidgetView w={widget} />}
                {widget.type === "quote" && editing && (
                  <QuoteWidgetEditor widget={widget} onChange={updateWidget} />
                )}

                {widget.type === "link" && !editing && <LinkWidgetView w={widget} />}
                {widget.type === "link" && editing && (
                  <LinkWidgetEditor widget={widget} onChange={updateWidget} />
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
                  <div className="space-y-2 rounded-lg border border-line bg-panel p-3">
                    <div className="flex items-center gap-3 text-slate-400">
                      <FileText className="h-6 w-6" />
                      <p className="text-sm font-semibold">PDF attachments will be re-added in future when more database storage is added.</p>
                    </div>
                    <input type="file" accept="application/pdf" disabled title="PDF attachments will be re-added in future when more database storage is added." className="w-full cursor-not-allowed rounded-lg border border-line bg-slate-100 px-3 py-2 text-sm text-slate-400" />
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
