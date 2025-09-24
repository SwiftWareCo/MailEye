import { ForgotPassword } from "@stackframe/stack";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Reset Password
          </h1>
          <p className="text-gray-300">
            Enter your email to receive a password reset link
          </p>
        </div>
        <div className="bg-gray-900/80 backdrop-blur-sm p-6 rounded-lg border border-gray-800">
          <ForgotPassword />
        </div>
      </div>
    </div>
  );
}