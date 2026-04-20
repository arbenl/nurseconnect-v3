"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
};

export default function AuthProvider({ children }: Props) {
  return <>{children}</>;
}
