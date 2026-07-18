"use client";

import { useMemo, useState } from "react";
import { worldCountries, searchWorldCountries, type WorldCountry } from "@/data/world-countries";

export function useWorldCountries() {
  const [search, setSearch] = useState("");

  const filteredCountries = useMemo(() => searchWorldCountries(search), [search]);

  const countries = useMemo(() => worldCountries, []);

  return {
    countries,
    filteredCountries,
    search,
    setSearch,
  };
}

export function getCountryCurrency(countryCode: string): WorldCountry | undefined {
  return worldCountries.find((c) => c.code.toUpperCase() === countryCode.toUpperCase());
}