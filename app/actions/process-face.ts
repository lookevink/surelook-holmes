"use server";

import { createEvent } from "@/lib/events";
import { findIdentityByFaceEmbedding } from "@/lib/identities";

export async function processFace(
    embedding: number[],
    sessionId: string
) {
    try {
        // 1. Find identity
        const identity = await findIdentityByFaceEmbedding(embedding);

        // 2. Create event
        const content = identity
            ? `Recognized ${identity.name}`
            : "Detected unknown face";

        await createEvent({
            sessionId,
            type: "VISUAL_OBSERVATION",
            content,
            relatedIdentityId: identity?.id || null,
        });

        return {
            identityId: identity?.id,
            identityName: identity?.name,
            recognized: !!identity,
        };
    } catch (error) {
        console.error("Error processing face:", error);
        return { error: "Failed to process face" };
    }
}
