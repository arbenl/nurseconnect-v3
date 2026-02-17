export type MeResponse =
    | { ok: true; session: null; user: null }
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
            role: "admin" | "nurse" | "patient";
            profile: {
                firstName: string | null;
                lastName: string | null;
                phone: string | null;
                city: string | null;
                address: string | null;
            };
            nurseProfile?: {
                licenseNumber: string | null;
                specialization: string | null;
                isAvailable: boolean;
            };
            profileComplete: boolean;
        };
    };
