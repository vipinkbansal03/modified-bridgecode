import { AppError } from "../../../utils/apiResponse";
import { ExchangeRateResult, IExchangeRateProvider } from "./exchangeRateProvider.interface";

export class ErApiProvider implements IExchangeRateProvider {
  name = "ExchangeRate-API (Open API)";

  async fetchLatestRates(baseCurrencyCode: string): Promise<ExchangeRateResult> {
    const baseCode = baseCurrencyCode.trim().toUpperCase();
    const baseUrl = (process.env.EXCHANGE_RATE_API_URL || "https://open.er-api.com/v6/latest").replace(/\/$/, "");
    const url = `${baseUrl}/${encodeURIComponent(baseCode)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AppError(`Exchange rate provider HTTP error ${response.status}: ${response.statusText}`, 502);
      }

      const data = (await response.json()) as {
        result?: string;
        base_code?: string;
        rates?: Record<string, number>;
        time_last_update_utc?: string;
        "error-type"?: string;
      };

      if (data.result !== "success" || !data.rates || typeof data.rates !== "object") {
        const errorMsg = data["error-type"] || "Invalid response format from exchange rate provider.";
        throw new AppError(`Exchange rate provider error: ${errorMsg}`, 502);
      }

      return {
        baseCode: data.base_code || baseCode,
        rates: data.rates,
        timeLastUpdateUtc: data.time_last_update_utc,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError("Exchange rate provider request timed out (8s limit exceeded).", 504);
      }
      throw new AppError(
        `Failed to reach exchange rate provider: ${error instanceof Error ? error.message : "Network failure."}`,
        502
      );
    }
  }
}

export const defaultExchangeRateProvider = new ErApiProvider();
