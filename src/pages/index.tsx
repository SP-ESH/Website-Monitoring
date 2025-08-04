// pages/index.tsx
import ComprehensiveMonitor from "@/components/ComprehensiveMonitor";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-gray-900">Website Monitoring Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive website monitoring with DNS, SSL, domain expiration, port scanning, ping monitoring, and keyword tracking
          </p>
        </div>
      </div>

      <ComprehensiveMonitor />
    </main>
  );
}
