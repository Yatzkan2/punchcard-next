"use client";

import { useState, useEffect } from "react";
import "../i18n.js";
import { SettingsProvider } from "@/lib/SettingsContext.jsx";

export default function Providers({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <SettingsProvider>{children}</SettingsProvider>;
}
