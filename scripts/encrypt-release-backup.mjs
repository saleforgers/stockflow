import { createCipheriv, constants, publicEncrypt, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

// Receive pg_dump on stdin; plaintext is never written to disk or an artifact.
const publicKey = Buffer.from(process.env.BACKUP_PUBLIC_KEY ?? "", "base64").toString("utf8");
const destination = process.argv[2];
if (!publicKey.includes("BEGIN PUBLIC KEY") || !destination) {
  throw new Error("Backup public key and destination are required");
}
const key = randomBytes(32);
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const header = Buffer.from(
  JSON.stringify({
    version: 1,
    encryption: "AES-256-GCM/RSA-OAEP-SHA256",
    iv: iv.toString("base64"),
    wrappedKey: publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      key,
    ).toString("base64"),
    createdAt: new Date().toISOString(),
  }),
);
const length = Buffer.alloc(4);
length.writeUInt32BE(header.length);
const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
output.write(length);
output.write(header);
await pipeline(process.stdin, cipher, output, { end: false });
output.end(cipher.getAuthTag());
await new Promise((resolve, reject) => {
  output.once("finish", resolve);
  output.once("error", reject);
});
console.info("Encrypted public-schema backup completed");
