"use client";

import Link from "next/link";

export default function ResultsPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-6">Results Page</h1>

      <div className="space-y-4">
        <Link
          href="/camera"
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors block text-center"
        >
          Go to Camera
        </Link>

        <Link
          href="/"
          className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors block text-center"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
