export const config = { runtime: "edge" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const q      = searchParams.get("q")?.trim();
  const number = searchParams.get("number")?.trim();

  const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!apiKey) {
    console.error("[api/companies-house] COMPANIES_HOUSE_API_KEY not set");
    return json({ error: "Companies House API key not configured" }, 500);
  }

  // Direct lookup by company number
  if (number) {
    const chUrl = `https://api.company-information.service.gov.uk/company/${encodeURIComponent(number)}`;
    const response = await fetch(chUrl, {
      headers: { Authorization: `Basic ${btoa(`${apiKey}:`)}` },
    });
    if (!response.ok) {
      return json({ error: `Companies House returned ${response.status}` }, 502);
    }
    const c = (await response.json()) as {
      company_name: string;
      company_number: string;
      company_status: string;
      date_of_creation?: string;
      registered_office_address?: {
        address_line_1?: string;
        address_line_2?: string;
        locality?: string;
        postal_code?: string;
        country?: string;
      };
    };
    return json({
      company_name:    c.company_name,
      company_number:  c.company_number,
      company_status:  c.company_status,
      date_of_creation: c.date_of_creation ?? null,
      address_line_1:  c.registered_office_address?.address_line_1 ?? "",
      address_line_2:  c.registered_office_address?.address_line_2 ?? "",
      locality:        c.registered_office_address?.locality ?? "",
      postal_code:     c.registered_office_address?.postal_code ?? "",
      country:         c.registered_office_address?.country ?? "",
    });
  }

  // Search by name/query
  if (!q || q.length < 2) {
    return json({ items: [] });
  }

  const chUrl = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=8`;

  const response = await fetch(chUrl, {
    headers: {
      Authorization: `Basic ${btoa(`${apiKey}:`)}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[api/companies-house] upstream error:", response.status, body);
    return json({ error: `Companies House returned ${response.status}`, detail: body }, 502);
  }

  const data = (await response.json()) as {
    items?: {
      title: string;
      company_number: string;
      company_status: string;
      date_of_creation?: string;
      address?: {
        address_line_1?: string;
        address_line_2?: string;
        locality?: string;
        postal_code?: string;
        country?: string;
      };
      description?: string;
    }[];
  };

  const items = (data.items ?? []).map((c) => ({
    company_name: c.title,
    company_number: c.company_number,
    company_status: c.company_status,
    date_of_creation: c.date_of_creation ?? null,
    address_line_1: c.address?.address_line_1 ?? "",
    address_line_2: c.address?.address_line_2 ?? "",
    locality: c.address?.locality ?? "",
    postal_code: c.address?.postal_code ?? "",
    country: c.address?.country ?? "",
    description: c.description ?? "",
  }));

  return json({ items });
}
