import "dotenv/config";

import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../../src/generated/prisma/client";
import { auth } from "../../src/lib/auth/auth";
import { bootstrapFirstAdmin } from "../../src/modules/authentication/services";

const directUrl = process.env["DIRECT_URL"];
if (!directUrl) throw new Error("DIRECT_URL is required");
if (process.env["STOCKFLOW_DATABASE_TARGET"] !== "development-disposable")
  throw new Error("Refusing auth integration tests on a non-disposable database");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: directUrl }) });
const emailPrefix = "p1b-auth-";
const password = "Integration-Only-Password-1075";

async function createCredentialUser(
  role: "ADMIN" | "MANAGER" | "STAFF" = "STAFF",
  isActive = true,
) {
  const id = randomUUID();
  const email = `${emailPrefix}${randomUUID()}@example.test`;
  await db.user.create({
    data: {
      id,
      name: "Auth Test User",
      email,
      emailVerified: true,
      role,
      isActive,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });
  return { id, email };
}
async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { startsWith: emailPrefix } },
    select: { id: true },
  });
  await db.user.deleteMany({ where: { id: { in: users.map(({ id }) => id) } } });
}
function signInRequest(email: string, inputPassword = password) {
  return new Request("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password: inputPassword, rememberMe: false }),
  });
}
function cookieFrom(response: Response) {
  const header = response.headers.get("set-cookie");
  if (!header) throw new Error("Sign-in did not return a cookie");
  const match = header.match(/stockflow\.session_token=[^;]+/);
  if (!match) throw new Error("Session cookie was not found");
  return match[0];
}
async function getSession(cookie?: string) {
  const response = await auth.handler(
    new Request("http://localhost:3000/api/auth/get-session", {
      headers: cookie ? { cookie } : {},
    }),
  );
  return { response, body: (await response.json()) as unknown };
}

describe("Better Auth database sessions", () => {
  beforeAll(async () => db.$connect());
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });
  it("authenticates valid credentials and stores a non-plaintext password", async () => {
    const user = await createCredentialUser();
    const response = await auth.handler(signInRequest(user.email));
    expect(response.ok, await response.clone().text()).toBe(true);
    const cookie = cookieFrom(response);
    const session = await getSession(cookie);
    expect(session.body).toMatchObject({ user: { email: user.email } });
    const account = await db.account.findFirstOrThrow({ where: { userId: user.id } });
    expect(account.password).not.toBe(password);
  });
  it("rejects invalid credentials without creating a session", async () => {
    const user = await createCredentialUser();
    const response = await auth.handler(signInRequest(user.email, "wrong-password-value"));
    expect(response.ok).toBe(false);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
  it("denies inactive users", async () => {
    const user = await createCredentialUser("STAFF", false);
    const response = await auth.handler(signInRequest(user.email));
    expect(response.ok).toBe(false);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
  });
  it("invalidates logout sessions", async () => {
    const user = await createCredentialUser();
    const signIn = await auth.handler(signInRequest(user.email));
    const cookie = cookieFrom(signIn);
    const signOut = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-out", {
        method: "POST",
        headers: { cookie, origin: "http://localhost:3000", "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(signOut.ok).toBe(true);
    expect((await getSession(cookie)).body).toBeNull();
  });
  it("rejects expired sessions and unauthenticated requests", async () => {
    const user = await createCredentialUser();
    const response = await auth.handler(signInRequest(user.email));
    const cookie = cookieFrom(response);
    await db.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await getSession(cookie)).body).toBeNull();
    expect((await getSession()).body).toBeNull();
  });
  it("bootstraps exactly one first Admin and refuses replay", async () => {
    const email = `${emailPrefix}${randomUUID()}@example.test`;
    const created = await bootstrapFirstAdmin({ name: "First Admin Test", email, password }, db);
    expect((await db.user.findUniqueOrThrow({ where: { id: created.id } })).role).toBe("ADMIN");
    await expect(
      bootstrapFirstAdmin(
        {
          name: "Second Admin",
          email: `${emailPrefix}${randomUUID()}@example.test`,
          password,
        },
        db,
      ),
    ).rejects.toThrow("already exists");
  });
});
