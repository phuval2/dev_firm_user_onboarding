import fetch from "node-fetch";

export async function handler(event) {
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE = "appHuFySGdecIs6Cq";
  const tableName = "Master Products";
  const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(tableName)}`;

  console.log("🔐 AIRTABLE_TOKEN starts with:", AIRTABLE_TOKEN?.slice(0, 6));

  let records = [];
  let offset = null;

  try {
    do {
      const url = offset ? `${baseUrl}?offset=${offset}` : baseUrl;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`
        }
      });

      const data = await response.json();
      if (!data.records) break;

      records.push(...data.records);
      offset = data.offset;
    } while (offset);

    console.log("Fetched records:", records.map(r => r.fields["Product Name"]));

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

    // Optional: Sort products alphabetically
    for (const category in map) {
      for (const subcategory in map[category]) {
        map[category][subcategory].sort((a, b) => a.localeCompare(b));
      }
    }

    console.log("Built nested category map:", map);

    return {
      statusCode: 200,
      body: JSON.stringify(map)
    };

  } catch (err) {
    console.error("Error fetching Airtable categories:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to load categories" })
    };
  }
}


