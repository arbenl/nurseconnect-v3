export type AppShellRole = "patient" | "nurse" | "partner";

type AppShellNavItem = {
  href: string;
  label: string;
};

type AppShellConfig = {
  portalLabel: string;
  summary: string;
  navItems: AppShellNavItem[];
};

const APP_SHELL_CONFIG: Record<AppShellRole, AppShellConfig> = {
  patient: {
    portalLabel: "Patient Portal",
    summary: "Request care and track your active visit.",
    navItems: [{ href: "/dashboard", label: "Dashboard" }],
  },
  nurse: {
    portalLabel: "Nurse Portal",
    summary: "Manage availability and respond to assignments.",
    navItems: [{ href: "/dashboard", label: "Dashboard" }],
  },
  partner: {
    portalLabel: "Partner Portal",
    summary: "Submit referrals and track your own request outcomes.",
    navItems: [
      { href: "/partner", label: "Dashboard" },
      { href: "/partner", label: "Referrals" },
    ],
  },
};

export function getAppShellConfig(role: AppShellRole): AppShellConfig {
  return APP_SHELL_CONFIG[role];
}
