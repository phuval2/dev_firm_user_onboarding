import fetch from "node-fetch";

async function getSubcategoriesMap() {
  const AIRTABLE_BASE = "appHuFySGdecIs6Cq";
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const tableName = "Master Products";
  const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(tableName)}`;

  let records = [];
  let offset = null;

  do {
    const url = offset ? `${baseUrl}?pageSize=100&offset=${offset}` : `${baseUrl}?pageSize=100`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`
      }
    });

    if (!res.ok) throw new Error("Failed to fetch category map from Airtable");

    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  const map = {};

  for (const record of records) {
    const parent = record.fields["Category"]?.trim();
    const child = record.fields["Product Name"]?.trim();
    if (!parent || !child) continue;
    if (!map[parent]) map[parent] = [];
    if (!map[parent].includes(child)) {
      map[parent].push(child);
    }
  }

  return map;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  try {
    const { userFields, jurisdictionPayloads } = JSON.parse(event.body);
    const subcategoriesMap = await getSubcategoriesMap();
    const mappedUserFields = {
      "First Name": userFields.firstName,
      "Last Name": userFields.lastName,
      "Email": userFields.email,
      "Phone": userFields.officePhone,         
      "Cell Phone": userFields.cellPhone, 
      "Firm Name": userFields.firmName,
      "Job Title": userFields.jobTitle,
      "Is Attorney": userFields.isAttorney ? "Yes" : "No",

      ...(userFields.dateAdmitted ? { "Date Admitted": userFields.dateAdmitted } : {})
    };


    const AIRTABLE_BASE = "appHuFySGdecIs6Cq";
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

    const userRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/User%20Onboarding%202`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields: mappedUserFields })
    });

    const userData = await userRes.json();
    console.log("Airtable user response:", userRes.status, JSON.stringify(userData));

    if (!userRes.ok) throw new Error("User creation failed");

    const userId = userData.id;

    if (userFields.isAttorney && Array.isArray(jurisdictionPayloads)) {
      for (const j of jurisdictionPayloads) {
        for (const service of j.services) {
          const parentCategory = Object.entries(subcategoriesMap).find(([parent, children]) =>
            children.includes(service.product)
          )?.[0] || "Unknown";


          await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Jurisdictions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${AIRTABLE_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              fields: {
                Jurisdiction: j.jurisdiction,
                "Bar Number": j.barNumber,
                ...(j.patentLicense ? { "Patent License Number": j.patentLicense } : {}),
                "Parent Categories": parentCategory,
                "Subcategory": service.subcategory,
                "Services": service.product,
                "Linked User": [userId],
                "User": `${userFields.firstName} ${userFields.lastName}`,
                "Litigation": j.doesLitigation,
              }
            })
          });
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error("Function error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}

