import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Vektrum',
  description: 'Vektrum Privacy Policy — how we collect, use, and protect your data.',
}

export default function PrivacyPage() {
  return (
    <div className="bg-[#0D1B2A]">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 py-16 sm:py-20">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-[-0.025em]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-[15px] text-white/55">Last updated: April 17, 2026</p>

        <div className="mt-10 space-y-10">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-semibold text-white">1. Information We Collect</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/55">
              <p>
                <strong className="text-white">Account Data.</strong> When you create an account, we collect your name, email address, company name, and role (contractor or funder). We do not store passwords directly; authentication is managed by our infrastructure provider, Supabase.
              </p>
              <p>
                <strong className="text-white">Usage Data.</strong> We collect information about how you interact with the platform, including pages visited, features used, timestamps of activity, and device/browser information. This data is used to improve the service and diagnose issues.
              </p>
              <p>
                <strong className="text-white">Payment Data.</strong> Payment processing is handled entirely by Stripe. Vektrum does not store credit card numbers, bank account details, or other sensitive payment credentials. Stripe may collect information in accordance with their own privacy policy.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-semibold text-white">2. How We Use Information</h2>
            <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-white/55 list-disc pl-5">
              <li><strong className="text-white">Service Delivery.</strong> To operate the platform, process milestone governance, and facilitate communication between contractors and funders.</li>
              <li><strong className="text-white">Fraud Prevention.</strong> To detect, investigate, and prevent fraudulent transactions and unauthorized access.</li>
              <li><strong className="text-white">Legal Compliance.</strong> To comply with applicable laws, regulations, and legal processes.</li>
              <li><strong className="text-white">Platform Improvement.</strong> To analyze usage patterns and improve the functionality, reliability, and security of Vektrum.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-semibold text-white">3. Data Sharing</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/55">
              <p>We share data only with the following categories of third parties, and only as necessary to operate the service:</p>
              <ul className="space-y-2 list-disc pl-5">
                <li><strong className="text-white">Stripe</strong> for payment processing and Stripe Connect account management.</li>
                <li><strong className="text-white">Supabase</strong> for authentication and database infrastructure.</li>
                <li><strong className="text-white">AI Service Providers</strong> for automated draw review analysis, using only project and milestone metadata (never personal financial data).</li>
              </ul>
              <p>We do not sell, rent, or trade your personal information to any third party for marketing purposes.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-semibold text-white">4. Data Retention</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/55">
              <p>Account data is retained for as long as your account is active. Audit log entries and transaction records are retained indefinitely for compliance and dispute resolution purposes.</p>
              <p>Upon account closure, personal data (name, email, company) is deleted within 30 days. Anonymized transaction and audit records may be retained for legal and compliance obligations.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-semibold text-white">5. Your Rights</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/55">
              <p>You have the right to:</p>
              <ul className="space-y-2 list-disc pl-5">
                <li><strong className="text-white">Access</strong> the personal data we hold about you.</li>
                <li><strong className="text-white">Correct</strong> any inaccurate or incomplete personal data.</li>
                <li><strong className="text-white">Delete</strong> your personal data, subject to legal retention requirements.</li>
                <li><strong className="text-white">Export</strong> your data in a portable format.</li>
              </ul>
              <p>
                To exercise any of these rights, contact us at{' '}
                <a href="mailto:support@vektrum.io" className="text-blue-300 hover:underline">
                  support@vektrum.io
                </a>.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-semibold text-white">6. Security</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/55">
              <p>We implement industry-standard security measures to protect your data, including:</p>
              <ul className="space-y-2 list-disc pl-5">
                <li>Encryption in transit (TLS 1.2+) and at rest.</li>
                <li>SOC 2 aligned infrastructure through our cloud and database providers.</li>
                <li>Role-based access control with a principle of least privilege.</li>
                <li>Immutable audit logging for all sensitive operations.</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-semibold text-white">7. Contact</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/55">
              If you have questions about this Privacy Policy or our data practices, contact us at{' '}
              <a href="mailto:support@vektrum.io" className="text-blue-300 hover:underline">
                support@vektrum.io
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
