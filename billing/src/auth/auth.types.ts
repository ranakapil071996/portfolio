export type UserStatus = "pending_onboarding" | "active";

export type AuthUser = {
  id: string;
  mobile: string;
  status: UserStatus;
};

export type SessionPayload = {
  needsOnboarding: boolean;
  user: {
    id: string;
    mobile: string;
    status: UserStatus;
  };
  business: {
    id: string;
    name: string;
    mobile: string;
    gstin: string | null;
  } | null;
};
