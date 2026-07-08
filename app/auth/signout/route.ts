import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Supabase sign out failed", error);
    return NextResponse.redirect(new URL("/app?error=signout_failed", request.url), { status: 302 });
  }

  revalidatePath("/", "layout");
  return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
}
