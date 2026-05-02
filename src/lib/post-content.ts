import { type PostType } from "@/lib/mock-data";

export type TextWidget = {
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
export type ImageWidget = { id: string; type: "image"; src: string; caption: string };
export type PdfWidget = { id: string; type: "pdf"; filename: string };
export type CalloutWidget = {
  id: string;
  type: "callout";
  variant: "info" | "warning" | "success";
  content: string;
  color?: string;
  icon?: string;
};
export type CodeWidget = {
  id: string;
  type: "code";
  language: string;
  filename?: string;
  content: string;
};
export type ChecklistWidget = {
  id: string;
  type: "checklist";
  title?: string;
  items: { id: string; text: string; checked: boolean }[];
};
export type StepsWidget = {
  id: string;
  type: "steps";
  title?: string;
  steps: { id: string; text: string }[];
};
export type TableWidget = {
  id: string;
  type: "table";
  title?: string;
  columns: string[];
  rows: string[][];
};
export type QuoteWidget = {
  id: string;
  type: "quote";
  content: string;
  source?: string;
};
export type LinkWidget = {
  id: string;
  type: "link";
  label: string;
  url: string;
  description?: string;
};
export type DividerWidget = { id: string; type: "divider" };

export type Widget =
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

export const defaultContent: Record<string, Widget[]> = {
  "1": [
    { id: "a1", type: "text", content: "Shared mailboxes allow multiple users to read and send email from a common address without requiring a separate licence.\n\n**Steps to create:**\n1. Go to admin.exchange.microsoft.com\n2. Click Mailboxes -> Shared -> Add\n3. Enter display name and email address\n4. Click Create, then add members" },
    { id: "a2", type: "callout", variant: "info", content: "Shared mailboxes do not require a licence unless the mailbox exceeds 50 GB or you enable litigation hold." },
    { id: "a3", type: "text", content: "**Granting access:**\nOnce created, go to the mailbox properties and add members under Delegation -> Send As and Full Access." }
  ],
  "6": [
    { id: "b1", type: "callout", variant: "warning", content: "Always verify the user's identity via video call or in person before resetting a password." },
    { id: "b2", type: "text", content: "**Self-Service (SSPR):**\n1. User visits aka.ms/sspr\n2. Enters their UPN and completes MFA\n3. Sets a new password that meets complexity requirements\n\n**Admin Reset (AD Users & Computers):**\n1. Open ADUC, locate the user\n2. Right-click -> Reset Password\n3. Uncheck 'User must change password at next logon' only if requested by a manager" }
  ],
  "8": [
    { id: "c1", type: "text", content: "Complete this checklist before the new starter's first day." },
    { id: "c2", type: "callout", variant: "success", content: "Target: all accounts and hardware ready 24 hours before start date." },
    { id: "c3", type: "text", content: "**Accounts:**\n- [ ] Create AD user account\n- [ ] Assign M365 licence\n- [ ] Add to relevant security groups\n- [ ] Create email signature\n\n**Hardware:**\n- [ ] Enrol device in Intune\n- [ ] Install required software via Intune apps\n- [ ] Confirm device name follows naming convention" }
  ],
  "14": [
    { id: "d1", type: "text", content: "Download the 3CX softphone from the link emailed by the system or from your internal app portal." },
    { id: "d2", type: "callout", variant: "info", content: "Use the QR code provisioning method where possible - it avoids manual server entry errors." },
    { id: "d3", type: "text", content: "**Installation steps:**\n1. Run the installer as administrator\n2. Open 3CX and choose 'Scan QR code'\n3. Log in to the 3CX web portal, go to your extension, and display the QR code\n4. Scan with the desktop app camera prompt\n5. Test inbound and outbound calls" }
  ]
};

export function getPostWidgets(post: { id: string; widgets?: Widget[] }) {
  return post.widgets ?? defaultContent[post.id] ?? [];
}

export function derivePostType(
  widgets: Widget[],
  fallback?: PostType
): PostType | "empty" {
  const hasPdf = widgets.some((widget) => widget.type === "pdf");
  const hasWritten = widgets.some(
    (widget) =>
      widget.type === "text" ||
      widget.type === "callout" ||
      widget.type === "code" ||
      widget.type === "checklist" ||
      widget.type === "steps" ||
      widget.type === "table" ||
      widget.type === "quote" ||
      widget.type === "link" ||
      widget.type === "image" ||
      widget.type === "divider"
  );

  if (hasPdf && hasWritten) return "both";
  if (hasPdf) return "pdf";
  if (hasWritten) return "written";

  return fallback ?? "empty";
}
