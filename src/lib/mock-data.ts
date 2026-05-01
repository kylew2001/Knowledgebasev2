import {
  BadgeCheck,
  BookOpenText,
  Cable,
  Cloud,
  FileText,
  Fingerprint,
  HardDrive,
  KeyRound,
  Laptop,
  LockKeyhole,
  MonitorSmartphone,
  Network,
  Package,
  Phone,
  Printer,
  Router,
  ShieldAlert,
  Smartphone,
  UserCog,
  Wifi
} from "lucide-react";
import { type VisibilityRule } from "@/lib/visibility";

export const iconOptions = [
  { name: "Book", icon: BookOpenText },
  { name: "PDF", icon: FileText },
  { name: "Laptop", icon: Laptop },
  { name: "Network", icon: Network },
  { name: "Router", icon: Router },
  { name: "Wi-Fi", icon: Wifi },
  { name: "Cable", icon: Cable },
  { name: "Printer", icon: Printer },
  { name: "Phone", icon: Smartphone },
  { name: "Devices", icon: MonitorSmartphone },
  { name: "Storage", icon: HardDrive },
  { name: "Cloud", icon: Cloud },
  { name: "Users", icon: UserCog },
  { name: "Password", icon: KeyRound },
  { name: "Access", icon: LockKeyhole },
  { name: "Identity", icon: Fingerprint },
  { name: "Security", icon: ShieldAlert },
  { name: "Verified", icon: BadgeCheck }
];

export const categoryCards = [
  {
    title: "Microsoft 365",
    description: "Mailbox, Teams, licensing, SharePoint, OneDrive, and account guidance.",
    count: 18,
    icon: Cloud,
    color: "#0f766e",
    tags: ["Exchange", "Teams", "Licensing"],
    subcategories: [
      "Shared Mailboxes",
      "Teams Setup",
      "OneDrive & SharePoint",
      "Licensing",
      "Exchange Rules",
      "Distribution Lists"
    ],
    visibility: { mode: "everyone", groupIds: [] } as VisibilityRule,
    subcategoryVisibility: {} as Record<string, VisibilityRule>
  },
  {
    title: "Active Directory",
    description: "User lifecycle, groups, password resets, lockouts, and access changes.",
    count: 24,
    icon: UserCog,
    color: "#2563eb",
    tags: ["Users", "Groups", "GPO"],
    subcategories: [
      "New User Setup",
      "Password Resets",
      "Account Unlocks",
      "Group Management",
      "GPO Issues",
      "Offboarding"
    ],
    visibility: { mode: "everyone", groupIds: [] } as VisibilityRule,
    subcategoryVisibility: {} as Record<string, VisibilityRule>
  },
  {
    title: "Networking",
    description: "VPN, Wi-Fi, switch ports, DNS, DHCP, and connectivity checks.",
    count: 15,
    icon: Network,
    color: "#b45309",
    tags: ["VPN", "DNS", "DHCP"],
    subcategories: [
      "VPN Troubleshooting",
      "Wi-Fi Issues",
      "DNS & DHCP",
      "Switch Ports",
      "Firewall Rules",
      "Connectivity Checks"
    ],
    visibility: { mode: "everyone", groupIds: [] } as VisibilityRule,
    subcategoryVisibility: {} as Record<string, VisibilityRule>
  },
  {
    title: "Printers",
    description: "Driver installs, print queues, follow-me print, and common faults.",
    count: 11,
    icon: Printer,
    color: "#7c3aed",
    tags: ["Drivers", "Queues", "MFD"],
    subcategories: [
      "Driver Installation",
      "Print Queue Issues",
      "Follow-Me Print",
      "MFD Setup",
      "Network Printers",
      "Fax Configuration"
    ],
    visibility: { mode: "everyone", groupIds: [] } as VisibilityRule,
    subcategoryVisibility: {} as Record<string, VisibilityRule>
  },
  {
    title: "Endpoints",
    description: "Laptop builds, device repairs, Intune enrolment, and peripherals.",
    count: 21,
    icon: Laptop,
    color: "#be123c",
    tags: ["Intune", "Hardware", "Builds"],
    subcategories: [
      "Laptop Builds",
      "Intune Enrolment",
      "Hardware Faults",
      "Peripheral Setup",
      "OS Reinstalls",
      "Device Compliance"
    ],
    visibility: { mode: "everyone", groupIds: [] } as VisibilityRule,
    subcategoryVisibility: {} as Record<string, VisibilityRule>
  },
  {
    title: "Security",
    description: "Phishing triage, access reviews, incident notes, and account recovery.",
    count: 9,
    icon: ShieldAlert,
    color: "#475569",
    tags: ["Phishing", "MFA", "Incidents"],
    subcategories: [
      "Phishing Triage",
      "MFA Setup",
      "Account Recovery",
      "Access Reviews",
      "Incident Response",
      "Security Audits"
    ],
    visibility: { mode: "everyone", groupIds: [] } as VisibilityRule,
    subcategoryVisibility: {} as Record<string, VisibilityRule>
  },
  {
    title: "Telephony",
    description: "3CX phone system, extensions, voicemail, call groups, and softphone setup.",
    count: 8,
    icon: Phone,
    color: "#0369a1",
    tags: ["3CX", "Extensions", "Voicemail"],
    subcategories: [
      "3CX Setup",
      "Extension Configuration",
      "Voicemail Setup",
      "Call Recording",
      "Ring Groups",
      "Softphone Issues"
    ],
    visibility: { mode: "everyone", groupIds: [] } as VisibilityRule,
    subcategoryVisibility: {} as Record<string, VisibilityRule>
  },
  {
    title: "Phoenix",
    description: "ERP system access, general ledger, accounts payable, reporting, and data issues.",
    count: 13,
    icon: Package,
    color: "#b45309",
    tags: ["ERP", "Finance", "Reporting"],
    subcategories: [
      "User Access",
      "General Ledger",
      "Accounts Payable",
      "Accounts Receivable",
      "Reporting",
      "Data Imports",
      "System Errors"
    ],
    visibility: { mode: "everyone", groupIds: [] } as VisibilityRule,
    subcategoryVisibility: {} as Record<string, VisibilityRule>
  }
];

export type PostType = "pdf" | "written" | "both";

export type MockPost = {
  id: string;
  title: string;
  publishedBy: string;
  publishedAt: string;
  type?: PostType;
  subcategory: string;
  category: string;
  widgets?: import("@/lib/post-content").Widget[];
  visibility?: VisibilityRule;
};

export const mockPosts: MockPost[] = [
  // Microsoft 365 – Shared Mailboxes
  { id: "1", title: "How to create a shared mailbox in Exchange Admin", publishedBy: "Kyle W", publishedAt: "2026-04-15", type: "written", subcategory: "Shared Mailboxes", category: "Microsoft 365" },
  { id: "2", title: "Granting full access to a shared mailbox", publishedBy: "Kyle W", publishedAt: "2026-04-10", type: "pdf", subcategory: "Shared Mailboxes", category: "Microsoft 365" },
  { id: "3", title: "Shared mailbox not showing in Outlook – fix guide", publishedBy: "Service Desk", publishedAt: "2026-03-28", type: "both", subcategory: "Shared Mailboxes", category: "Microsoft 365" },
  // Microsoft 365 – Teams Setup
  { id: "4", title: "Setting up a new Teams channel and permissions", publishedBy: "Kyle W", publishedAt: "2026-04-18", type: "written", subcategory: "Teams Setup", category: "Microsoft 365" },
  { id: "5", title: "Teams guest access configuration guide", publishedBy: "Service Desk", publishedAt: "2026-04-02", type: "pdf", subcategory: "Teams Setup", category: "Microsoft 365" },
  // Active Directory – Password Resets
  { id: "6", title: "Self-service password reset setup for end users", publishedBy: "Kyle W", publishedAt: "2026-04-20", type: "written", subcategory: "Password Resets", category: "Active Directory" },
  { id: "7", title: "Admin password reset procedure – AD Users & Computers", publishedBy: "Service Desk", publishedAt: "2026-04-05", type: "both", subcategory: "Password Resets", category: "Active Directory" },
  // Active Directory – New User Setup
  { id: "8", title: "New starter onboarding checklist", publishedBy: "Kyle W", publishedAt: "2026-04-22", type: "pdf", subcategory: "New User Setup", category: "Active Directory" },
  { id: "9", title: "Creating a new AD user and assigning groups", publishedBy: "Kyle W", publishedAt: "2026-04-01", type: "written", subcategory: "New User Setup", category: "Active Directory" },
  // Networking – VPN Troubleshooting
  { id: "10", title: "FortiClient VPN connection drops – common fixes", publishedBy: "Service Desk", publishedAt: "2026-04-12", type: "written", subcategory: "VPN Troubleshooting", category: "Networking" },
  { id: "11", title: "VPN split tunnelling configuration guide", publishedBy: "Kyle W", publishedAt: "2026-03-30", type: "pdf", subcategory: "VPN Troubleshooting", category: "Networking" },
  // Endpoints – Laptop Builds
  { id: "12", title: "Standard laptop build process with Intune Autopilot", publishedBy: "Kyle W", publishedAt: "2026-04-19", type: "both", subcategory: "Laptop Builds", category: "Endpoints" },
  { id: "13", title: "Pre-build BIOS checklist", publishedBy: "Service Desk", publishedAt: "2026-03-15", type: "pdf", subcategory: "Laptop Builds", category: "Endpoints" },
  // Telephony – 3CX Setup
  { id: "14", title: "3CX softphone installation on Windows", publishedBy: "Kyle W", publishedAt: "2026-04-08", type: "both", subcategory: "3CX Setup", category: "Telephony" },
  { id: "15", title: "Provisioning a new extension in 3CX", publishedBy: "Kyle W", publishedAt: "2026-03-22", type: "written", subcategory: "3CX Setup", category: "Telephony" },
  // Phoenix – User Access
  { id: "16", title: "Requesting new Phoenix ERP user access", publishedBy: "Kyle W", publishedAt: "2026-04-16", type: "written", subcategory: "User Access", category: "Phoenix" },
  { id: "17", title: "Phoenix role permission matrix", publishedBy: "Kyle W", publishedAt: "2026-04-03", type: "pdf", subcategory: "User Access", category: "Phoenix" },
];

export const auditEvents = [
  {
    event: "PDF uploaded",
    actor: "admin@example.com",
    target: "VPN troubleshooting checklist.pdf",
    time: "12 min ago"
  },
  {
    event: "Role changed",
    actor: "superadmin@example.com",
    target: "sam@example.com moved to editor",
    time: "35 min ago"
  },
  {
    event: "Failed login",
    actor: "unknown",
    target: "viewer@example.com",
    time: "1 hr ago"
  },
  {
    event: "Category edited",
    actor: "admin@example.com",
    target: "Microsoft 365",
    time: "Yesterday"
  }
];

export const users = [
  {
    name: "Kyle Wilson",
    email: "kyle@example.com",
    role: "super_admin",
    status: "Active",
    lastLogin: "Today"
  },
  {
    name: "Service Desk",
    email: "servicedesk@example.com",
    role: "editor",
    status: "Active",
    lastLogin: "Yesterday"
  },
  {
    name: "Read Only",
    email: "viewer@example.com",
    role: "viewer",
    status: "Locked",
    lastLogin: "3 days ago"
  }
];
