const fetch = require("node-fetch");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  try {
    const { userFields, jurisdictionPayloads } = JSON.parse(event.body);
    const AIRTABLE_BASE = "appHuFySGdecIs6Cq";
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;

    // Create the user in Airtable
    const userRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/User%20Onboarding%202`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields: userFields })
    });

    if (!userRes.ok) throw new Error("User creation failed");

    const userData = await userRes.json();
    const userId = userData.id;

    // Create each jurisdiction record
    for (const j of jurisdictionPayloads) {
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
            "Parent Categories": j.parentCategories.join(", "),
            "Services": j.services.join(", "),
            "Linked User": [userId]
          }
        })
      });
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
};
