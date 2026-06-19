"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "./queryConfig";

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  // makeQueryClient includes production-grade stale times, retry logic, etc.
  const [client] = useState(() => makeQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
