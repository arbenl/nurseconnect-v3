
import { CreateRequestSchema } from "@nurseconnect/contracts";
import { db, eq } from "@nurseconnect/database";
import { schema } from "@nurseconnect/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCachedUser } from "@/lib/auth/user";
import { haversineDistance } from "@/lib/location";

const { serviceRequests, nurseLocations, nurses, users } = schema;

export async function POST(request: Request) {
    try {
        const user = await getCachedUser();
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const json = await request.json();
        const body = CreateRequestSchema.parse(json);

        // Transaction: find + lock available nurse, then assign
        const newRequest = await db.transaction(async (tx) => {
            // 1. Find available nurses with location (FOR UPDATE SKIP LOCKED for race safety)
            const availableNurses = await tx
                .select({
                    userId: users.id,
                    lat: nurseLocations.lat,
                    lng: nurseLocations.lng,
                })
                .from(users)
                .innerJoin(nurses, eq(nurses.userId, users.id))
                .innerJoin(nurseLocations, eq(nurseLocations.nurseUserId, users.id))
                .where(eq(nurses.isAvailable, true))
                .for("update", { skipLocked: true });

            // 2. Allocation Logic: Find closest by Haversine distance
            let assignedNurseUserId: string | null = null;
            let minDistance = Infinity;

            const requestLoc = { lat: body.lat, lng: body.lng };

            for (const nurse of availableNurses) {
                // Convert NUMERIC to number for calculation
                const nurseLat = parseFloat(nurse.lat as string);
                const nurseLng = parseFloat(nurse.lng as string);
                const dist = haversineDistance(requestLoc, { lat: nurseLat, lng: nurseLng });

                if (dist < minDistance) {
                    minDistance = dist;
                    assignedNurseUserId = nurse.userId;
                }
            }

            // 3. Create Request (and assign if nurse found)
            const [created] = await tx
                .insert(serviceRequests)
                .values({
                    patientUserId: user.id,
                    assignedNurseUserId,
                    status: assignedNurseUserId ? "assigned" : "open",
                    address: body.address,
                    lat: body.lat.toString(),
                    lng: body.lng.toString(),
                })
                .returning();

            return created;
        });

        return NextResponse.json(newRequest);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse(JSON.stringify(error.issues), { status: 400 });
        }
        console.error("Request creation error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
