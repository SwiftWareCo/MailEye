import Signout from "@/app/_components/auth/Signout";
import { getUserWithMetadata } from "@/server/auth/auth.data";

export default async function DashboardPage() {
  const userWithMetadata = await getUserWithMetadata();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              Welcome to MailEye
            </h1>
            <p className="text-xl text-gray-300 mb-6">
              Hello, {userWithMetadata?.displayName || userWithMetadata?.primaryEmail || "User"}!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-2">
                Active Campaigns
              </h3>
              <p className="text-3xl font-bold text-blue-400">0</p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-2">
                Total Emails Sent
              </h3>
              <p className="text-3xl font-bold text-green-400">0</p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-2">
                Response Rate
              </h3>
              <p className="text-3xl font-bold text-purple-400">0%</p>
            </div>
            <Signout />
          </div>
        </div>
      </div>
    </div>
  );
}