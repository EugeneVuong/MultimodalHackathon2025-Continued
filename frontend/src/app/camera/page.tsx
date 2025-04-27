"use client";

import dynamic from "next/dynamic";

// Dynamically import the client component with SSR disabled
const CameraClient = dynamic(() => import("./CameraClient"), { ssr: false });

export default function Page() {
  return <CameraClient />;
}