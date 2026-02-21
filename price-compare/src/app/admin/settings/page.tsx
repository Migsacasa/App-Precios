import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsEditor } from "@/components/admin/settings-editor";

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/observations");

  const settings = await getSettings();

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">App Settings</h1>
      <p className="text-sm opacity-80">Configure scoring thresholds, recency window, retention, and other system-level parameters.</p>
      <SettingsEditor initialSettings={settings} />
    </div>
  );
}
