import dynamic from "next/dynamic";

// Dynamically import the client component with SSR disabled
const DashboardClient = dynamic(() => import("./DashboardClient"), { ssr: false });

export default function Page() {
  return <DashboardClient />;
}
