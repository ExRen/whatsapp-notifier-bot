/**
 * Pecah array mentions jadi beberapa chunk
 * WhatsApp biasanya limit ~5000 karakter per pesan
 */
export function chunkMentions(mentions, maxPerChunk = 50) {
  const chunks = [];
  for (let i = 0; i < mentions.length; i += maxPerChunk) {
    chunks.push(mentions.slice(i, i + maxPerChunk));
  }
  return chunks;
}

/**
 * Bangun teks mention dari array JID
 */
export function buildMentionText(jids = []) {
  return jids
    .map(jid => `@${String(jid).split('@')[0]}`)
    .join(' ');
}