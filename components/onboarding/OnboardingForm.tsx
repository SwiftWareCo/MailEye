'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserWithMetadata } from '@/server/auth/auth.data';
import { completeOnboardingWithData } from '@/server/auth/auth.actions';

interface OnboardingFormProps {
  user: UserWithMetadata;
}

export default function OnboardingForm({ user }: OnboardingFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    role: '',
    industry: '',
    teamSize: '',
    primaryGoal: '',
    experienceLevel: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      // Call the server action directly instead of API route
      const result = await completeOnboardingWithData(formData);

      if (result.success) {
        setMessage({ type: 'success', text: 'Welcome to MailEye! Redirecting to your dashboard...' });
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setMessage({ type: 'error', text: result.message || 'Failed to complete onboarding' });
      }
    } catch (error) {
      console.error('Onboarding error:', error);
      setMessage({
        type: 'error',
        text: 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.firstName && formData.lastName && formData.primaryGoal && formData.experienceLevel;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-md ${
          message.type === 'success'
            ? 'bg-green-900/20 border border-green-700 text-green-400'
            : 'bg-red-900/20 border border-red-700 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Personal Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-300 mb-2">
            First Name <span className="text-red-400">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            value={formData.firstName}
            onChange={handleInputChange}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your first name"
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-300 mb-2">
            Last Name <span className="text-red-400">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            value={formData.lastName}
            onChange={handleInputChange}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your last name"
          />
        </div>
      </div>

      {/* Professional Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">
            Company
          </label>
          <input
            id="company"
            name="company"
            type="text"
            value={formData.company}
            onChange={handleInputChange}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Your company name"
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-2">
            Job Title/Role
          </label>
          <input
            id="role"
            name="role"
            type="text"
            value={formData.role}
            onChange={handleInputChange}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Sales Manager, Marketing Director"
          />
        </div>
      </div>

      {/* Business Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-gray-300 mb-2">
            Industry
          </label>
          <select
            id="industry"
            name="industry"
            value={formData.industry}
            onChange={handleInputChange}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select your industry</option>
            <option value="technology">Technology</option>
            <option value="finance">Finance</option>
            <option value="healthcare">Healthcare</option>
            <option value="education">Education</option>
            <option value="retail">Retail</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="consulting">Consulting</option>
            <option value="real-estate">Real Estate</option>
            <option value="marketing">Marketing & Advertising</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="teamSize" className="block text-sm font-medium text-gray-300 mb-2">
            Team Size
          </label>
          <select
            id="teamSize"
            name="teamSize"
            value={formData.teamSize}
            onChange={handleInputChange}
            className="w-full bg-gray-700/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select team size</option>
            <option value="1">Just me</option>
            <option value="2-10">2-10 people</option>
            <option value="11-50">11-50 people</option>
            <option value="51-200">51-200 people</option>
            <option value="200+">200+ people</option>
          </select>
        </div>
      </div>

      {/* Goals and Experience */}
      <div>
        <label htmlFor="primaryGoal" className="block text-sm font-medium text-gray-300 mb-2">
          Primary Goal <span className="text-red-400">*</span>
        </label>
        <select
          id="primaryGoal"
          name="primaryGoal"
          required
          value={formData.primaryGoal}
          onChange={handleInputChange}
          className="w-full bg-gray-700/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">What's your main goal with MailEye?</option>
          <option value="lead-generation">Lead Generation</option>
          <option value="sales-outreach">Sales Outreach</option>
          <option value="partnership-building">Partnership Building</option>
          <option value="recruitment">Recruitment</option>
          <option value="customer-acquisition">Customer Acquisition</option>
          <option value="networking">Networking</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-300 mb-2">
          Experience Level <span className="text-red-400">*</span>
        </label>
        <select
          id="experienceLevel"
          name="experienceLevel"
          required
          value={formData.experienceLevel}
          onChange={handleInputChange}
          className="w-full bg-gray-700/50 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">How experienced are you with cold email?</option>
          <option value="beginner">Beginner (New to cold email)</option>
          <option value="intermediate">Intermediate (Some experience)</option>
          <option value="advanced">Advanced (Very experienced)</option>
          <option value="expert">Expert (Cold email professional)</option>
        </select>
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="w-full inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Completing Setup...
            </>
          ) : (
            <>
              Complete Setup & Continue
              <svg className="ml-2 -mr-1 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </form>
  );
}