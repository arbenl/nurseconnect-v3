export type MeResponse =
    | { ok: true; session: null; user: null }
    | { ok: false; session: null; user: null; error: string }
    | {
        ok: true;
        session: {
            id: string;
            userId: string;
        };
        user: {
            id: string;
            authId: string;
            email: string | null;
            name: string | null;
            role: "admin" | "nurse" | "patient" | "referral_partner";
            profile: {
                firstName: string | null;
                lastName: string | null;
                phone: string | null;
                city: string | null;
                address: string | null;
            };
            nurseProfile:
                | {
                    status: string;
                    licenseNumber: string | null;
                    licenseJurisdiction: string | null;
                    specialization: string | null;
                    licenseValidUntil: string | null;
                    isAvailable: boolean;
                }
                | null;
            profileComplete: boolean;
        };
    };
