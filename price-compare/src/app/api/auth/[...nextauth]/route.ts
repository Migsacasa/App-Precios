import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";

function resolveAuthUrl(req: Request) {
	const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
	const proto = req.headers.get("x-forwarded-proto") ?? "http";

	if (!host) return process.env.NEXTAUTH_URL;
	return `${proto}://${host}`;
}

function authHandler(req: Request, context: unknown) {
	const dynamicUrl = resolveAuthUrl(req);
	if (dynamicUrl) {
		process.env.NEXTAUTH_URL = dynamicUrl;
	}

	return NextAuth(authOptions)(req, context);
}

export { authHandler as GET, authHandler as POST };