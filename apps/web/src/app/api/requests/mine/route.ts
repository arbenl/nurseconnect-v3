
import { db, eq, or, desc } from "@nurseconnect/database";
import { schema } from "@nurseconnect/database";
import { NextResponse } from "next/server";

import { getCachedUser } from "@/lib/auth/user";

const { serviceRequests } = schema;

export async function GET() {
    const user = await getCachedUser();
    if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Simple userId-based query (no nurse join needed)
    const requests = await db
        .select()
        .from(serviceRequests)
        .where(
            or(
                eq(serviceRequests.patientUserId, user.id),
                eq(serviceRequests.assignedNurseUserId, user.id)
            )
        )
        .orderBy(desc(serviceRequests.createdAt));

    return NextResponse.json(requests);
}
