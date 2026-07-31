export interface ExchangeRateResult {
  baseCode: string;
  rates: Record<string, number>;
  timeLastUpdateUtc?: string;
}

export interface IExchangeRateProvider {
  name: string;
  fetchLatestRates(baseCurrencyCode: string): Promise<ExchangeRateResult>;
}
