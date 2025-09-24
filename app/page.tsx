import Link from "next/link";
import { stackServerApp } from "../stack/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await stackServerApp.getUser();

  // If user is authenticated, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-white mb-4">
            MailEye
          </h1>
          <p className="text-lg text-gray-300 mb-8">
            Professional cold email management platform
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/handler/sign-in"
            className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-500 transition-colors shadow-lg"
          >
            Sign In
          </Link>

          <Link
            href="/handler/sign-up"
            className="block w-full bg-gray-700 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-600 transition-colors border border-gray-600"
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
