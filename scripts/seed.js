require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");
const { prayers } = require("./prayers-data");

// Verify environment variables are loaded
if (
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_KEY ||
  !process.env.OPENAI_API_KEY
) {
  console.error("Missing environment variables. Check your scripts/.env file.");
  process.exit(1);
}

// Service key bypasses Row Level Security — only use in server-side scripts
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Call OpenAI to convert text into a 1536-dimensional embedding vector
async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text.replace(/\n/g, " "), // OpenAI recommends removing newlines
  });
  return response.data[0].embedding; // Array of 1536 numbers
}

// Sleep helper — prevents hitting OpenAI rate limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(`Starting seed with ${prayers.length} prayers...`);
  console.log("Loading religions from database...");

  // Fetch all religion IDs so we can map religion name -> UUID
  const { data: religions, error: relError } = await supabase
    .from("religions")
    .select("id, name");

  if (relError) {
    console.error("Failed to load religions:", relError.message);
    console.error(
      "Make sure you ran the schema SQL in Supabase first (Step 1.3 and 1.4).",
    );
    process.exit(1);
  }

  // Build a lookup map: "Christianity" -> "uuid-here"
  const religionMap = {};
  religions.forEach((r) => {
    religionMap[r.name] = r.id;
  });

  console.log(
    `Loaded ${religions.length} religions:`,
    Object.keys(religionMap).join(", "),
  );
  console.log("");

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < prayers.length; i++) {
    const prayer = prayers[i];
    const progressLabel = `[${i + 1}/${prayers.length}]`;

    // Warn if this prayer's religion is not in the database
    if (!religionMap[prayer.religion]) {
      console.warn(
        `${progressLabel} WARNING: Religion "${prayer.religion}" not found in database. Skipping: ${prayer.title}`,
      );
      errorCount++;
      continue;
    }

    console.log(`${progressLabel} Embedding: "${prayer.title}"`);

    try {
      // Combine title + body for a richer embedding
      const textToEmbed = `${prayer.title}. ${prayer.body}`;
      const embedding = await getEmbedding(textToEmbed);

      // Insert prayer into Supabase with its embedding vector
      const { error } = await supabase.from("prayers").upsert(
        {
          title: prayer.title,
          body: prayer.body,
          religion_id: religionMap[prayer.religion],
          tradition: prayer.tradition || null,
          language: prayer.language || "en",
          original_language: prayer.original_language || null,
          original_text: prayer.original_text || null,
          occasion: prayer.occasion || [],
          mood: prayer.mood || [],
          source: prayer.source || null,
          source_url: prayer.source_url || null,
          approved: true,
          // Supabase requires the vector to be passed as a JSON string
          embedding: JSON.stringify(embedding),
        },
        { onConflict: "title", ignoreDuplicates: true },
      );

      if (error) {
        console.error(`  ✗ Insert failed: ${error.message}`);
        errorCount++;
      } else {
        console.log(`  ✓ Inserted successfully`);
        successCount++;
      }

      // Wait 200ms between requests to stay under OpenAI rate limits
      // For 1,000 prayers this adds about 3.5 minutes total — totally fine
      await sleep(200);
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      errorCount++;
    }
  }

  console.log("");
  console.log("═══════════════════════════════");
  console.log(`✓ Seeding complete!`);
  console.log(`  Inserted: ${successCount}`);
  console.log(`  Errors:   ${errorCount}`);
  console.log("");
  console.log("Next step: go to Supabase → Table Editor → prayers");
  console.log('Confirm rows exist and the "embedding" column is NOT null.');
}

main();
