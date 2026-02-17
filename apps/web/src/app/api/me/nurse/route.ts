import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth";
import { db, schema, eq } from "@nurseconnect/database";
import { ensureDomainUserFromSession } from "@/lib/user-service";

const nurseProfileSchema = z.object({
    licenseNumber: z.string().min(1, "License number is required"),
    specialization: z.string().min(1, "Specialization is required"),
    isAvailable: z.boolean().optional(),
});

export async function PATCH(request: Request) {
    const session = await getSession();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const json = await request.json();
        const result = nurseProfileSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json({ error: "Invalid data", details: result.error }, { status: 400 });
        }

        const { licenseNumber, specialization, isAvailable } = result.data;

        // Verify user role
        const user = await ensureDomainUserFromSession({
            id: session.user.id,
            email: session.user.email!,
        });

        if (!user || user.role !== "nurse") {
            return NextResponse.json({ error: "Forbidden: User is not a nurse" }, { status: 403 });
        }

        // Check if nurse record exists
        const existingNurse = await db.query.nurses.findFirst({
            where: eq(schema.nurses.userId, user.id),
        });

        if (existingNurse) {
            await db
                .update(schema.nurses)
                .set({
                    licenseNumber,
                    specialization,
                    isAvailable: isAvailable ?? existingNurse.isAvailable,
                    updatedAt: new Date(),
                })
                .where(eq(schema.nurses.id, existingNurse.id));
        } else {
            await db.insert(schema.nurses).values({
                userId: user.id,
                status: "pending",
                licenseNumber,
                specialization,
                isAvailable: isAvailable ?? false,
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("PATCH /api/me/nurse failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
