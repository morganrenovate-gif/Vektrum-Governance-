import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Vektrum',
  description: 'Vektrum Terms of Service for the construction payment governance platform.',
}

export default function TermsPage() {
  return (
    <div className="bg-[#0D1B2A]">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 py-16 sm:py-20">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-[-0.025em]">
          Terms of Service
        </h1>
        <p className="mt-2 text-[15px] text-white/55">Last updated: April 17, 2026</p>

        <div className="mt-10 space-y-10">
          {/* Section 1 */}
          <section>
            <h2 className="text-lg font-semibold text-white">1. Acceptance</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/55">
              By accessing or using the Vektrum platform (&ldquo;Service&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the Service. Vektrum reserves the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-lg font-semibold text-white">2. Description of Service</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/55">
              <p>
                Vektrum is a milestone-gated construction project financing governance platform. The Service provides tools for contractors and funders to structure deals, define milestones, manage draw requests, and govern the release of funds based on verified conditions.
              </p>
              <p>
                Vektrum is a governance and authorization layer. Funds are held in Stripe Connect managed accounts, not by Vektrum. Vektrum is not a bank, lender, or money transmitter.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-lg font-semibold text-white">3. User Accounts</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/55">
              <p>You must provide accurate, complete, and current information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</p>
              <p>You agree to immediately notify Vektrum of any unauthorized use of your account. Vektrum is not liable for any loss or damage arising from your failure to safeguard your account credentials.</p>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-lg font-semibold text-white">4. Contractor Terms</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/55">
              <p>For deals using Stripe Connect payment rails, contractors must connect a Stripe account via Stripe Connect before receiving payments. Contractors are responsible for:</p>
              <ul className="space-y-2 list-disc pl-5">
                <li>Providing accurate project descriptions, milestone definitions, and amounts.</li>
                <li>Submitting truthful documentation for milestone completion and draw requests.</li>
                <li>Complying with all applicable laws, regulations, and licensing requirements for construction work.</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-lg font-semibold text-white">5. Funder Terms</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/55">
              <p>Funders use the platform to fund deals and approve milestone-gated releases. Funders acknowledge and agree that:</p>
              <ul className="space-y-2 list-disc pl-5">
                <li>Funds are held in Stripe Connect managed accounts, not by Vektrum.</li>
                <li>Release of funds is subject to the platform&rsquo;s 10-condition server-side release gate, preceded by an AI-assisted draw review precondition. Together these verify milestone approval, contract status, funded balance, contractor payout eligibility, documentation, change-order status, lien-waiver status (where required), and sequential-release ordering (where required) before any transfer is authorized.</li>
                <li>Vektrum does not guarantee the quality or completion of construction work performed by contractors.</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-lg font-semibold text-white">6. Prohibited Conduct</h2>
            <div className="mt-3 text-[15px] leading-relaxed text-white/55">
              <p>You agree not to:</p>
              <ul className="mt-3 space-y-2 list-disc pl-5">
                <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
                <li>Submit false, misleading, or fraudulent information, including milestone documentation.</li>
                <li>Attempt to circumvent the platform&rsquo;s security measures, release conditions, or audit controls.</li>
                <li>Interfere with or disrupt the Service, servers, or networks connected to the Service.</li>
                <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-lg font-semibold text-white">7. Intellectual Property</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/55">
              The Service, including its design, code, features, and documentation, is the property of Vektrum and is protected by intellectual property laws. You retain ownership of any content you submit to the platform. By using the Service, you grant Vektrum a limited license to use your content solely for the purpose of operating and improving the Service.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-lg font-semibold text-white">8. Disclaimers and Limitation of Liability</h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/55">
              <p>
                THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, VEKTRUM SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATING TO YOUR USE OF THE SERVICE, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.
              </p>
              <p>
                Vektrum does not guarantee the performance, reliability, or availability of third-party services, including Stripe and Supabase.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-lg font-semibold text-white">9. Governing Law</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/55">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict of law principles. Any disputes arising under these Terms shall be resolved in the state or federal courts located in the State of Delaware.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-lg font-semibold text-white">10. Changes to Terms</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/55">
              Vektrum reserves the right to modify these Terms at any time. Material changes will be communicated via email or a prominent notice on the platform. Your continued use of the Service following the posting of changes constitutes your acceptance of those changes.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2 className="text-lg font-semibold text-white">11. Contact</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/55">
              For questions about these Terms, contact us at{' '}
              <a href="mailto:legal@vektrum.io" className="text-vektrum-blue hover:underline">
                legal@vektrum.io
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
