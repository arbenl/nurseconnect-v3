import { db, schema, eq } from "@nurseconnect/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/server/auth";

const { users } = schema;

const profileSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().min(1, "Phone number is required"),
    city: z.string().min(1, "City is required"),
    address: z.string().optional(),
});

export async function PATCH(req: Request) {
    try {
        const session = await getSession();

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const result = profileSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.flatten() },
                { status: 400 },
            );
        }

        const { firstName, lastName, phone, city, address } = result.data;

        // Check if profile is now complete
        // We already validated required fields are non-empty strings
        const isComplete = true;

        // Update user
        const [updatedUser] = await db
            .update(users)
            .set({
                firstName,
                lastName,
                phone,
                city,
                address,
                profileCompletedAt: isComplete ? new Date() : null, // Set timestamp if complete
                updatedAt: new Date(),
            })
            .where(eq(users.authId, session.user.id)) // session.user.id is authId
            .returning();

        if (!updatedUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            ok: true,
            user: {
                id: updatedUser.id,
                authId: updatedUser.authId,
                email: updatedUser.email,
                role: updatedUser.role,
                profile: {
                    firstName: updatedUser.firstName,
                    lastName: updatedUser.lastName,
                    phone: updatedUser.phone,
                    city: updatedUser.city,
                    address: updatedUser.address,
                },
                profileComplete: !!updatedUser.profileCompletedAt,
            },
        });
    } catch (error) {
        console.error("PATCH /api/me/profile failed", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
