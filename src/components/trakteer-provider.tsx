"use client";

import { type ReactNode } from "react";
import TrakteerWidget from "@/components/trakteer-widget";

export default function TrakteerProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <TrakteerWidget />
    </>
  );
}