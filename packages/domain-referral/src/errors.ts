export class ReferralPartnerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferralPartnerValidationError";
  }
}

export class ReferralPartnerNotFoundError extends Error {
  constructor(message = "Referral partner profile not found") {
    super(message);
    this.name = "ReferralPartnerNotFoundError";
  }
}

export class ReferralPartnerInactiveError extends Error {
  constructor(message = "Referral partner profile is inactive") {
    super(message);
    this.name = "ReferralPartnerInactiveError";
  }
}
