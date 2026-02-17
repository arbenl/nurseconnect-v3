import { CreateRequestSchema } from "@nurseconnect/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCachedUser } from "@/lib/auth/user";
import { createAndAssignRequest } from "@/server/requests/allocate-request";

export async function POST(request: Request) {
    try {
        const user = await getCachedUser();
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const json = await request.json();
        const body = CreateRequestSchema.parse(json);

        const newRequest = await createAndAssignRequest({
            patientUserId: user.id,
            address: body.address,
            lat: body.lat,
            lng: body.lng,
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
