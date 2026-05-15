import { embedText } from "@/lib/embeddings";
import { writeMemory, retrieveSimilar, markRetrieved } from "@/lib/memory";

async function main() {
  console.log("=== Memory Retrieval Test ===\n");

  // Step 1: Write R1 — should be top result
  console.log("[1] Writing R1 (high-relevance)...");
  const r1 = await writeMemory({
    kind: "playbook",
    content:
      "When Gemini embedding latency exceeds 500ms, batch requests and add a 200ms retry backoff. This reduced p99 latency by 40%.",
    sourceTable: "test",
    sourceId: "test-memory-r1",
    metadata: { testRun: true },
  });
  console.log(`    → id=${r1.id} isNew=${r1.isNew}`);

  // Step 2: Write R2 — lower relevance (different domain)
  console.log("[2] Writing R2 (low-relevance)...");
  const r2 = await writeMemory({
    kind: "playbook",
    content:
      "Always set a budget alert at 80% of your monthly cloud spend limit to avoid surprise overages.",
    sourceTable: "test",
    sourceId: "test-memory-r2",
    metadata: { testRun: true },
  });
  console.log(`    → id=${r2.id} isNew=${r2.isNew}`);

  // Step 3: Embed the query
  const query =
    "embedding API is slow, how do I reduce latency for vector search?";
  console.log(`\n[3] Embedding query: "${query}"`);
  const { embedding, latencyMs } = await embedText(query, "RETRIEVAL_QUERY");
  console.log(`    → dims=${embedding.length} latency=${latencyMs}ms`);

  // Step 4: Retrieve similar
  console.log("\n[4] Retrieving similar memories...");
  const hits = await retrieveSimilar({
    queryEmbedding: embedding,
    kinds: ["playbook"],
    minSimilarity: 0.3,
    limit: 5,
  });
  console.log(`    → ${hits.length} hit(s) returned`);

  // Step 5: Print results
  console.log("\n[5] Results:");
  hits.forEach((h, i) => {
    console.log(
      `    [${i + 1}] id=${h.id.slice(0, 8)}... similarity=${h.similarity.toFixed(4)} score=${h.score.toFixed(4)}`
    );
    console.log(`        content: ${h.content.slice(0, 80)}...`);
  });

  // Step 6: Assertions
  console.log("\n[6] Assertions:");
  const pass = {
    atLeastOneResult: hits.length >= 1,
    r1IsFirst: hits.length > 0 && hits[0].id === r1.id,
    r1SimilarityAbove070: hits.length > 0 && hits[0].similarity >= 0.70,
  };

  for (const [key, ok] of Object.entries(pass)) {
    console.log(`    ${ok ? "PASS" : "FAIL"} ${key}`);
  }

  // Step 7: markRetrieved
  if (hits.length > 0) {
    await markRetrieved(hits.map((h) => h.id));
    console.log(`\n[7] markRetrieved called for ${hits.length} hit(s) OK`);
  }

  const allPassed = Object.values(pass).every(Boolean);
  console.log(`\n=== ${allPassed ? "ALL PASSED" : "SOME FAILED"} ===`);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
