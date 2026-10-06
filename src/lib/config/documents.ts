// Server-only configuration shared by every business document. Missing details are omitted.
export function documentCompany() {
  return {
    name: process.env.BUSINESS_NAME || "StockFlow",
    phone: process.env.BUSINESS_PHONE || "",
    email: process.env.BUSINESS_EMAIL || "",
    address: process.env.BUSINESS_ADDRESS || "",
    taxNumber: process.env.BUSINESS_NTN || "",
    logoPath: process.env.BUSINESS_LOGO_PATH || "",
  };
}
