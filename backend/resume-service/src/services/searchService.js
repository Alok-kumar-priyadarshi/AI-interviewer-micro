import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { embedTexts } from "./embedder.js";
import { getOwnedResumeRow } from "./resumeService.js";

const MIN_SIMILARITY = 0.2;

const toChunk = (row) => ({
  id: row.id,
  section: row.section,
  title: row.title,
  content: row.content,
  similarity: Number(Number(row.similarity ?? 0).toFixed(3)),
});

/**
 * Top-k chunks of one resume for a query. Uses cosine similarity over pgvector when an embedding
 * is available, otherwise (or when nothing is similar enough) Postgres full-text ranking.
 * Operators are schema-qualified because the runtime role's search_path is its own schema.
 */
export async function searchChunks(userId, resumeId, query, k) {
  // Ownership check and query embedding are independent: run them at the same time.
  const [, [vector]] = await Promise.all([getOwnedResumeRow(userId, resumeId), embedTexts([query])]);
  if (vector) {
    const literal = `[${vector.join(",")}]`;
    const result = await db.execute(sql`
      select id, section, title, content,
             1 - (embedding operator(public.<=>) ${literal}::public.vector) as similarity
      from resume.resume_chunks
      where resume_id = ${resumeId} and embedding is not null
      order by embedding operator(public.<=>) ${literal}::public.vector
      limit ${k}
    `);
    const chunks = result.rows.map(toChunk).filter((chunk) => chunk.similarity >= MIN_SIMILARITY);
    if (chunks.length) return chunks;
  }

  const result = await db.execute(sql`
    select id, section, title, content,
           ts_rank(
             to_tsvector('english', coalesce(title, '') || ' ' || content),
             websearch_to_tsquery('english', ${query})
           ) as similarity
    from resume.resume_chunks
    where resume_id = ${resumeId}
    order by similarity desc, created_at asc
    limit ${k}
  `);
  return result.rows.map(toChunk);
}
