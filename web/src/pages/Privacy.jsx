/*
 * Copyright © 2026 Lizalise Nzo & Dumabezwe Skele. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { Link } from 'react-router-dom';

export const CONSENT_VERSION = '1.0';

const S = ({ title, children }) => (
  <section style={{ marginTop: 22 }}>
    <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>{title}</h3>
    <div style={{ fontSize: 14.5, lineHeight: 1.65 }}>{children}</div>
  </section>
);

export default function Privacy() {
  return (
    <div className="container" style={{ maxWidth: 760, padding: '28px 18px 60px' }}>
      <div className="row between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div className="row" style={{ gap: 10, fontWeight: 800, fontSize: 20 }}>
          <span className="dot" /> GymIQ
        </div>
        <Link to="/login" className="btn btn-ghost" style={{ minHeight: 34 }}>← Back to sign in</Link>
      </div>

      <div className="card">
        <h1 style={{ fontSize: 26, marginTop: 0 }}>Privacy policy &amp; guardian consent</h1>
        <p className="subtle" style={{ marginTop: 0 }}>Version {CONSENT_VERSION} · Last updated July 2026 · Governed by the laws of the Republic of South Africa</p>

        <div style={{ border: '1px solid var(--border)', borderLeft: '4px solid var(--energy)', borderRadius: 12, padding: '12px 14px', marginTop: 16 }}>
          <strong>In short:</strong> GymIQ stores information about young athletes so their coach can run training,
          track development and keep families informed. We only collect what a coach genuinely needs, we never sell it,
          and a parent or guardian can ask to see or delete it at any time.
        </div>

        <S title="1. Who is responsible for this information">
          GymIQ is owned and operated by <strong>Lizalise Nzo</strong> and <strong>Dumabezwe Skele</strong> (jointly, the “Operator”), who acts as the responsible
          party under the Protection of Personal Information Act 4 of 2013 (“POPIA”). The sports academy using GymIQ
          is the operator of the data about its own players. Questions or requests can be sent to the academy in the
          first instance, or to the Operator.
        </S>

        <S title="2. Information we collect">
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            <li><strong>Account details</strong> — name, email address and role (player, coach or administrator).</li>
            <li><strong>Player profile</strong> — position, date of birth, shirt number, preferred foot, height and weight.</li>
            <li><strong>Guardian and emergency contacts</strong> — names and phone numbers used to reach a responsible adult.</li>
            <li><strong>Health information</strong> — allergies, injuries and return-to-play status, recorded so a player is kept safe.</li>
            <li><strong>Participation records</strong> — training attendance, match appearances, minutes played and statistics.</li>
            <li><strong>Coaching records</strong> — skill ratings, development goals and written notes from the coach.</li>
            <li><strong>Files</strong> — documents, photographs and video shared between a coach and a player.</li>
          </ul>
        </S>

        <S title="3. Children’s information">
          Most GymIQ users are under 18. Under POPIA, personal information about a child may only be processed with
          the consent of a competent person — normally a parent or legal guardian. By creating a player account, or by
          allowing a child to be added to a squad, the parent or guardian confirms they consent to the processing
          described in this policy. Consent can be withdrawn at any time by contacting the academy, after which the
          child’s record will be removed.
        </S>

        <S title="4. Why we process it">
          Information is used only to run the academy: organising training and fixtures, recording attendance, tracking
          development, communicating with families, and keeping players safe during activity. We do not use personal
          information for advertising, and we do not sell it or share it with third parties for their own purposes.
        </S>

        <S title="5. Health information">
          Allergies, injuries and medical notes are special personal information under POPIA. They are recorded solely
          so that coaching staff can protect a player’s wellbeing, manage a safe return to play, and act appropriately
          in an emergency. Access is limited to the player’s own coaches and academy administrators.
        </S>

        <S title="6. Photographs and video">
          Consent for photographs and video is requested <strong>separately</strong> and is optional. A player’s account
          works fully without it. Where given, images are used only within the academy — for coaching feedback and
          communication with families — and not for public marketing without a further, specific request.
        </S>

        <S title="7. Who can see what">
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            <li><strong>Players and their families</strong> see that player’s own record.</li>
            <li><strong>Coaches</strong> see only the players in the squads they run.</li>
            <li><strong>Academy administrators</strong> see players within their own academy.</li>
            <li>Coaches’ private journal notes are not visible to players or families.</li>
          </ul>
          These boundaries are enforced by database-level access rules, not only by the app screens.
        </S>

        <S title="8. Storage and security">
          Data is stored on Supabase infrastructure hosted in the European Union, protected in transit and at rest.
          Access is controlled by row-level security policies so that each account can reach only the records it is
          entitled to. Files are held in private storage and are not publicly reachable by URL.
        </S>

        <S title="9. How long we keep it">
          Records are kept while a player is registered with the academy and for a reasonable period afterwards to
          support continuity, transfers and historical performance records. A guardian may request earlier deletion.
        </S>

        <S title="10. Your rights under POPIA">
          A parent, guardian or adult account holder may ask to see the information held, correct anything inaccurate,
          request deletion, object to processing, or withdraw consent. Requests should go to the academy, who will
          action them. Complaints may also be lodged with the Information Regulator of South Africa.
        </S>

        <S title="11. Changes to this policy">
          If this policy changes in a way that materially affects how information is used, account holders will be asked
          to review and accept the updated version. Each acceptance is recorded with its version number and date.
        </S>

        <p className="subtle" style={{ fontSize: 12.5, marginTop: 26, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          This policy is provided in good faith and reflects how the software is built. It is not legal advice — the
          academy should have it reviewed by a South African attorney before operating at scale.
        </p>
      </div>
    </div>
  );
}
