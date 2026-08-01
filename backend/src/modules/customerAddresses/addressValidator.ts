import { AppError } from "../../utils/apiResponse";

export interface AddressInput {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
}

export interface ValidationVerdict {
  isValid: boolean;
  isCorrected: boolean;
  originalAddress: AddressInput;
  normalizedAddress: AddressInput | null;
  validationProvider: string;
  validationResult: any;
}

/**
 * Validates country required fields locally
 */
export function checkRequiredFields(address: AddressInput) {
  if (!address.addressLine1?.trim()) {
    throw new AppError("Address Line 1 is required.", 400);
  }
  if (!address.city?.trim()) {
    throw new AppError("City is required.", 400);
  }
  if (!address.state?.trim()) {
    throw new AppError("State is required.", 400);
  }
  if (!address.postalCode?.trim()) {
    throw new AppError("Postal/ZIP code is required.", 400);
  }
  if (!address.countryCode?.trim() || address.countryCode.length !== 2) {
    throw new AppError("A valid 2-letter Country Code is required.", 400);
  }
}

/**
 * Normalizes input casing as a fallback standardizer
 */
function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Standard address validation service calling Google or fallbacks to a mock
 */
export async function validateAddress(address: AddressInput): Promise<ValidationVerdict> {
  // 1. Check local required fields
  checkRequiredFields(address);

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // 2. Mock mode if Google API Key is missing or placeholder
  if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY" || apiKey.trim() === "") {
    console.log("[AddressValidator] Running in MOCK mode (GOOGLE_MAPS_API_KEY is not defined)");

    const isTestInvalid = address.city.toLowerCase().trim() === "invalid_test";

    if (isTestInvalid) {
      return {
        isValid: false,
        isCorrected: false,
        originalAddress: address,
        normalizedAddress: null,
        validationProvider: "mock-validator",
        validationResult: {
          verdict: {
            addressComplete: false,
            hasUnresolvedTokens: true,
            validationGranularity: "OTHER",
          },
        },
      };
    }

    // Capitalize and trim strings to construct a recommended "normalized" suggestion
    const cleanCity = titleCase(address.city.trim());
    const cleanState = titleCase(address.state.trim()).toUpperCase();
    const cleanZip = address.postalCode.trim().toUpperCase();

    // Check if the user's input matches normalized casing/spacing
    const isAlreadyClean =
      address.city.trim() === cleanCity &&
      address.state.trim() === cleanState &&
      address.postalCode.trim() === cleanZip;

    return {
      isValid: true,
      isCorrected: !isAlreadyClean,
      originalAddress: address,
      normalizedAddress: isAlreadyClean
        ? null
        : {
            addressLine1: address.addressLine1.trim(),
            addressLine2: address.addressLine2?.trim() || undefined,
            city: cleanCity,
            state: cleanState,
            postalCode: cleanZip,
            countryCode: address.countryCode.toUpperCase(),
          },
      validationProvider: "mock-validator",
      validationResult: {
        verdict: {
          addressComplete: true,
          hasUnresolvedTokens: false,
          validationGranularity: "PREMISE",
          hasReplacedComponents: !isAlreadyClean,
        },
        address: {
          formattedAddress: `${address.addressLine1.trim()}, ${cleanCity}, ${cleanState} ${cleanZip}, ${address.countryCode.toUpperCase()}`,
        },
      },
    };
  }

  // 3. Real mode calling Google API
  try {
    const url = `https://addressvalidation.googleapis.com/v1:validateAddress?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: {
          addressLines: [address.addressLine1, address.addressLine2].filter(Boolean),
          administrativeArea: address.state,
          locality: address.city,
          postalCode: address.postalCode,
          regionCode: address.countryCode.toUpperCase(),
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google API responded with status ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    const result = data.result;

    const verdict = result?.verdict;
    const addressComplete = verdict?.addressComplete ?? false;
    const hasUnresolvedTokens = verdict?.hasUnresolvedTokens ?? false;

    // Check if valid
    const isValid = addressComplete && !hasUnresolvedTokens;

    // Build the normalized suggestion from Google's response
    const postalAddress = result?.address?.postalAddress;
    let normalizedAddress: AddressInput | null = null;

    if (postalAddress) {
      normalizedAddress = {
        addressLine1: postalAddress.addressLines?.[0] || address.addressLine1,
        addressLine2: postalAddress.addressLines?.[1] || undefined,
        city: postalAddress.locality || address.city,
        state: postalAddress.administrativeArea || address.state,
        postalCode: postalAddress.postalCode || address.postalCode,
        countryCode: postalAddress.regionCode || address.countryCode,
      };
    }

    // Mismatches trigger a correction prompt
    const isCorrected =
      normalizedAddress &&
      (normalizedAddress.addressLine1 !== address.addressLine1 ||
        normalizedAddress.addressLine2 !== address.addressLine2 ||
        normalizedAddress.city !== address.city ||
        normalizedAddress.state !== address.state ||
        normalizedAddress.postalCode !== address.postalCode);

    return {
      isValid,
      isCorrected: !!isCorrected,
      originalAddress: address,
      normalizedAddress: isCorrected ? normalizedAddress : null,
      validationProvider: "google-address-validation",
      validationResult: result,
    };
  } catch (error: any) {
    console.error("[AddressValidator] Error calling Google validation API:", error);
    // If the API call fails due to invalid key or network issue, fallback safely
    throw new AppError(`Address validation failed: ${error.message}`, 500);
  }
}
