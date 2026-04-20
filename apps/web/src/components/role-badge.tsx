import React from 'react';

type Role = "patient" | "nurse" | "admin" | "referral_partner";

export default function RoleBadge({ role }: { role: Role }) {
  const label =
    role === "admin"
      ? "Admin"
      : role === "nurse"
        ? "Nurse"
        : role === "referral_partner"
          ? "Referral Partner"
          : "Patient";
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
      {label}
    </span>
  );
}
