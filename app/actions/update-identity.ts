"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function updateIdentity(
    identityId: string,
    updates: {
        name?: string;
        relationship_status?: string;
    }
) {
    try {
        const { data, error } = await supabase
            .from("identities")
            .update(updates)
            .eq("id", identityId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        revalidatePath("/");
        return { success: true, data };
    } catch (error) {
        console.error("Error updating identity:", error);
        return { success: false, error };
    }
}
