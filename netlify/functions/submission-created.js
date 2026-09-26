/* Texts Danny when someone fills in the contact form.
 *
 * Netlify calls this automatically on every form submission — the filename is
 * the trigger, nothing needs wiring up.
 *
 * Why this exists: carrier email-to-SMS gateways (vtext, txt.att.net,
 * tmomail.net) were tried first because they are free. All three were live for
 * a test submission on 2026-09-26 and none delivered. Carriers now filter mail
 * from hosting providers, which is what Netlify is. This route does not depend
 * on their goodwill.
 *
 * Needs four environment variables on the Netlify site. Without them it does
 * nothing and says so in the log — a missing variable must never break a form
 * submission, because the lead matters more than the alert:
 *
 *   TWILIO_ACCOUNT_SID   from the Twilio console
 *   TWILIO_AUTH_TOKEN    from the Twilio console  (secret)
 *   TWILIO_FROM          the Twilio number, E.164, e.g. +16305551234
 *   ALERT_TO             where the text goes, E.164, e.g. +16304860146
 */
export default async (req) => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, ALERT_TO } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM || !ALERT_TO) {
    console.log('Twilio env vars not set — no text sent. The submission is still saved.');
    return new Response('ok');       // never fail the submission over a missing alert
  }

  let d = {};
  try {
    const body = await req.json();
    d = body.payload?.data || body.data || {};
  } catch (e) {
    console.log('Could not read the submission payload:', e.message);
    return new Response('ok');
  }

  // Everything Danny needs to act without opening anything else.
  const lines = [
    'NEW LEAD — D&K Electric',
    [d.name, d.phone].filter(Boolean).join(' · '),
    d.service ? 'Job: ' + d.service : null,
    d.message ? String(d.message).replace(/\s+/g, ' ').slice(0, 220) : null,
    d.page ? 'From: ' + d.page : null,
    d.email || null,
  ].filter(Boolean);

  const params = new URLSearchParams({
    To: ALERT_TO,
    From: TWILIO_FROM,
    Body: lines.join('\n'),
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );
    console.log(res.ok ? 'Text sent.' : 'Twilio rejected it: ' + res.status + ' ' + (await res.text()).slice(0, 300));
  } catch (e) {
    console.log('Could not reach Twilio:', e.message);
  }

  return new Response('ok');
};
