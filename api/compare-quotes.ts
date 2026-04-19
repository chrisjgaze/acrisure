// Node.js runtime — 60s timeout (edge functions cap at 25s, not enough for Claude)
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { captureApiError } from "./_sentry.js";
import { logAuditEvent } from "./_audit.js";

interface InsurerFile {
  name: string;
  content: string;
}

interface InsurerQuote {
  label: string;
  files: InsurerFile[];
}

interface RequestBody {
  quotes: InsurerQuote[];
  classOfBusiness?: string;
  tenantId?: string;
  clientId?: string;
}

const SYSTEM_PROMPT = `You are an expert insurance placement analyst at a specialist insurance broker.
You are given a set of insurer quote documents (policy schedules, wordings, endorsements) and must produce:
1. A structured comparison table in JSON
2. A narrative analysis

For the comparison table, extract as many of these fields as are present (leave null if not found):
- premium (annual premium, include currency symbol and any IPT note)
- excess (per claim excess / retention — quote the exact wording)
- limit (maximum indemnity / limit of liability per the schedule)
- policy_period (policy dates or period stated)
- payment_terms (premium payment terms)
- key_exclusions (bullet list of the most material exclusions — max 6)
- special_conditions (special conditions, endorsements or subjectivities — max 4)
- maximum_extension (maximum buyer / customer credit limit or extension, if applicable)
- epi (estimated premium income or insured turnover basis, if stated)
- first_loss (first loss limit or aggregate limit if stated)
- discretionary_limit (any discretionary/automatic credit limit if mentioned)
- coverage_territory (territories covered)
- claims_notification (claims reporting requirements — condense to one sentence)
- notable_advantages (2–3 bullet points on this quote's strengths vs peers)
- notable_disadvantages (2–3 bullet points on this quote's weaknesses vs peers)

Always use exact figures/wording from the documents. If a value is ambiguous, include the verbatim text.

Return ONLY valid JSON with no markdown fences and no preamble:
{
  "comparison": [
    {
      "insurer": "<label>",
      "premium": "<value or null>",
      "excess": "<value or null>",
      "limit": "<value or null>",
      "policy_period": "<value or null>",
      "payment_terms": "<value or null>",
      "key_exclusions": ["...", "..."],
      "special_conditions": ["...", "..."],
      "maximum_extension": "<value or null>",
      "epi": "<value or null>",
      "first_loss": "<value or null>",
      "discretionary_limit": "<value or null>",
      "coverage_territory": "<value or null>",
      "claims_notification": "<value or null>",
      "notable_advantages": ["...", "..."],
      "notable_disadvantages": ["...", "..."]
    }
  ],
  "narrative": "<markdown narrative — 3–5 paragraphs comparing the quotes and recommending the most suitable option>"
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const body = req.body as RequestBody | undefined;
  const { quotes, classOfBusiness, tenantId, clientId } = body ?? {};

  if (!quotes || quotes.length === 0) {
    return res.status(400).json({ error: "No quotes provided" });
  }
  if (quotes.length > 8) {
    return res.status(400).json({ error: "Maximum 8 insurers per comparison" });
  }

  // Build plain-text content blocks — no document blocks, no beta header needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentBlocks: any[] = [];

  contentBlocks.push({
    type: "text",
    text: `Please compare the following insurer quotes${classOfBusiness ? ` for ${classOfBusiness} insurance` : ""}. There are ${quotes.length} insurer(s): ${quotes.map((q) => q.label).join(", ")}.`,
  });

  for (const quote of quotes) {
    contentBlocks.push({ type: "text", text: `\n---\n## Insurer: ${quote.label}\n` });
    for (const file of quote.files) {
      contentBlocks.push({ type: "text", text: `Document: ${file.name}\n\n${file.content}` });
    }
  }

  contentBlocks.push({
    type: "text",
    text: "\nNow produce the JSON comparison. Return only valid JSON, no markdown fences.",
  });

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error:", anthropicRes.status, errText);
      let friendlyError = "AI service error";
      try {
        const parsed = JSON.parse(errText) as { error?: { message?: string } };
        if (parsed.error?.message) friendlyError = parsed.error.message;
      } catch { /* ignore */ }
      return res.status(502).json({ error: friendlyError });
    }

    const result = await anthropicRes.json() as { content: { type: string; text: string }[] };
    const rawText = result.content.find((c) => c.type === "text")?.text ?? "";
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    try {
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      if (tenantId) {
        await logAuditEvent({ tenantId, submissionId: null, eventType: "quote_comparison.run", eventDetail: { client_id: clientId, class_of_business: classOfBusiness, insurer_count: quotes.length, insurers: quotes.map((q) => q.label) } });
      }
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({ raw: rawText });
    }
  } catch (err) {
    console.error("compare-quotes error:", err);
    captureApiError(err, { route: "api/compare-quotes" });
    return res.status(500).json({ error: String(err) });
  }
}
