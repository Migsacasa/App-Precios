import { type NextRequest } from "next/server";
import { POST as createObservationPost } from "@/app/api/observations/route";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return createObservationPost(req);
}
