"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapData } from "@/lib/apiClient";

export interface LoginSlideSetting {
  image: string;
  heading: string;
  subHeading: string;
  isVisible?: boolean;
}

export interface AuthPageSettings {
  login: {
    heading: string;
    subHeading: string;
    sliderEnabled: boolean;
    slides: LoginSlideSetting[];
  };
}

async function getAuthPageSettings() {
  const response = await apiClient.get("/settings/public/auth", {
    headers: { "Cache-Control": "no-cache" },
    params: { t: Date.now() },
  });
  return unwrapData<AuthPageSettings>(response);
}

export function useAuthPageSettings() {
  return useQuery({
    queryKey: ["public-auth-page-settings"],
    queryFn: getAuthPageSettings,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
