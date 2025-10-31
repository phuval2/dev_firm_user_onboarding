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
    const category = record.fields["Category"]?.trim();
    const subcategory = record.fields["Sub Category"]?.trim() || "Uncategorized";
    const product = record.fields["Product Name"]?.trim();

    if (!category || !product) continue;

    if (!map[category]) map[category] = {};
    if (!map[category][subcategory]) map[category][subcategory] = [];

    if (!map[category][subcategory].includes(product)) {
      map[category][subcategory].push(product);
    }
  }

  // Sort products alphabetically within each subcategory
  for (const category in map) {
    for (const subcategory in map[category]) {
      map[category][subcategory].sort((a, b) => a.localeCompare(b));
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
          // We already have the category and subcategory from the form data
          const parentCategory = service.category || "Unknown";


          const jurisdictionFields = {
            Jurisdiction: j.jurisdiction,
            "Bar Number": j.barNumber,
            ...(j.patentLicense ? { "Patent License Number": j.patentLicense } : {}),
            "Parent Categories": parentCategory,
            "Subcategory": service.subcategory,
            "Services": service.product,
            "Linked User": [userId],
            "User": `${userFields.firstName} ${userFields.lastName}`,
              "Appearance": service.courtAppearances ? "Yes" : "No",
              "Full Representation": service.fullRepresentation ? "Yes" : "No",
              "None": service.none ? "Yes" : "No",
              ...(service.courtCounties ? { "Counties Appearance": service.courtCounties } : {}),
              ...(service.representationCounties ? { "Counties Representation": service.representationCounties } : {})
          };

          console.log('Posting jurisdiction to Airtable with fields:', jurisdictionFields);

          await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/Jurisdictions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${AIRTABLE_TOKEN}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ fields: jurisdictionFields })
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

