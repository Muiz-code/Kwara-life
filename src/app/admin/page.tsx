import type { Metadata } from "next";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/** The admin panel. Signed-in admins only; the API answers "not found" to everyone else. */
export default function AdminPage() {
  return <AdminPanel />;
}
