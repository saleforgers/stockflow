import type { ActionResult } from "@/lib/actions/action-result";

export type PartyOption = {
  id: string;
  name: string;
  phone: string | null;
  accountBalance: string;
  recent?: boolean;
  isWalkIn?: boolean;
};

export type QuickPartyActionResult =
  ActionResult | { ok: true; message: string; party: PartyOption };

export type QuickPartyAction = (data: FormData) => Promise<QuickPartyActionResult>;
