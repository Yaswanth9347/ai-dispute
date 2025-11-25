import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border p-8">
        <div className="mb-8">
          <Link href="/auth/register" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            ← Back to Registration
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        
        <div className="prose max-w-none">
          <p className="text-gray-600 mb-6">
            Last Updated: November 25, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Introduction</h2>
            <p className="text-gray-700 mb-4">
              AI Dispute Resolver ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered dispute resolution platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">Personal Information</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>Name and contact information (email, phone number)</li>
              <li>District pin code and location data</li>
              <li>Account credentials (encrypted)</li>
              <li>Profile information</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">Dispute Information</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li>Details of disputes filed through the platform</li>
              <li>Evidence and documentation uploaded</li>
              <li>Communication and negotiation records</li>
              <li>Settlement agreements and outcomes</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">Technical Information</h3>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>IP address and browser type</li>
              <li>Device information</li>
              <li>Usage data and analytics</li>
              <li>Cookies and similar technologies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>To provide and maintain our dispute resolution services</li>
              <li>To process and analyze disputes using AI technology</li>
              <li>To facilitate communication between parties</li>
              <li>To improve our services and user experience</li>
              <li>To send notifications and updates about your disputes</li>
              <li>To comply with legal obligations</li>
              <li>To detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. AI Processing and Analysis</h2>
            <p className="text-gray-700 mb-4">
              We use artificial intelligence to analyze dispute information and provide recommendations. This processing:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Is automated and follows Indian legal principles</li>
              <li>Does not replace human judgment or legal counsel</li>
              <li>Is used to assist in fair and efficient dispute resolution</li>
              <li>Maintains confidentiality of all dispute information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Data Sharing and Disclosure</h2>
            <p className="text-gray-700 mb-4">
              We do not sell your personal information. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>With Dispute Parties:</strong> Information relevant to the dispute is shared with involved parties</li>
              <li><strong>Legal Requirements:</strong> When required by law or court order</li>
              <li><strong>Service Providers:</strong> With trusted third-party services that help operate our platform</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize sharing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Security</h2>
            <p className="text-gray-700 mb-4">
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Encryption of data in transit and at rest</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and authentication</li>
              <li>Secure data storage infrastructure</li>
              <li>Employee training on data protection</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Rights</h2>
            <p className="text-gray-700 mb-4">
              You have the following rights regarding your personal information:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data (subject to legal retention requirements)</li>
              <li><strong>Portability:</strong> Receive your data in a structured format</li>
              <li><strong>Objection:</strong> Object to certain processing of your data</li>
              <li><strong>Withdraw Consent:</strong> Withdraw consent for data processing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Data Retention</h2>
            <p className="text-gray-700 mb-4">
              We retain your information for as long as necessary to provide our services and comply with legal obligations. Dispute records may be retained for legal and historical purposes even after account closure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Cookies and Tracking</h2>
            <p className="text-gray-700 mb-4">
              We use cookies and similar technologies to improve user experience, analyze usage, and maintain session security. You can control cookie settings through your browser preferences.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Children's Privacy</h2>
            <p className="text-gray-700 mb-4">
              Our service is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to Privacy Policy</h2>
            <p className="text-gray-700 mb-4">
              We may update this Privacy Policy from time to time. We will notify you of significant changes by email or through the platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
            <p className="text-gray-700 mb-4">
              For questions about this Privacy Policy or to exercise your rights, please contact us at:
            </p>
            <p className="text-gray-700">
              Email: privacy@aidispute.com<br />
              Data Protection Officer: dpo@aidispute.com<br />
              Address: AI Dispute Resolver, India
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Compliance</h2>
            <p className="text-gray-700 mb-4">
              This Privacy Policy complies with the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and other applicable Indian data protection laws.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t">
          <Link href="/auth/register" className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            I Understand - Continue to Registration
          </Link>
        </div>
      </div>
    </div>
  );
}
