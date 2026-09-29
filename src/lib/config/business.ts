export const BUSINESS_CONFIG = Object.freeze({
  currencyCode: "PKR",
  timezone: "Asia/Karachi",
  defaultInventoryLocationCode: "MAIN",
  walkInCustomerName: "Walk-in Customer",
} as const);

export type BusinessConfig = typeof BUSINESS_CONFIG;
