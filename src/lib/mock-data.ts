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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
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
    ]
  }
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
