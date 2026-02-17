
import { db, eq, schema } from "@nurseconnect/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDomainUserFromSession } from "@/lib/user-service";
import { getSession } from "@/server/auth";

const becomeNurseSchema = z.object({
    licenseNumber: z.string().min(1, "License number is required"),
    specialization: z.string().min(1, "Specialization is required"),
});

export async function POST(request: Request) {
    const session = await getSession();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const json = await request.json();
        const result = becomeNurseSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json({ error: "Invalid data", details: result.error }, { status: 400 });
        }

        const { licenseNumber, specialization } = result.data;

        const user = await ensureDomainUserFromSession({
            id: session.user.id,
            email: session.user.email!,
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (user.role === "nurse") {
            return NextResponse.json({ error: "User is already a nurse" }, { status: 400 });
        }

        // Transaction to update role and add nurse record
        await db.transaction(async (tx) => {
            // 1. Update user role
            await tx.update(schema.users)
                .set({ role: "nurse" })
                .where(eq(schema.users.id, user.id));

            // 2. Create nurse record
            await tx.insert(schema.nurses).values({
                userId: user.id,
                status: "pending", // Default to pending verification
                licenseNumber,
                specialization,
                isAvailable: false,
            });
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("POST /api/me/become-nurse failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
