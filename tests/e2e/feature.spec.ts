import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("both peers agree on the current card after start", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByRole("button", { name: "load default pool", exact: true }).click();
    await b.waitForTimeout(400);
    await a.getByRole("button", { name: "start", exact: true }).click();
    await b.waitForTimeout(400);

    const cardA = (await a.locator(".cc-card-text").innerText()).trim();
    const cardB = (await b.locator(".cc-card-text").innerText()).trim();
    expect(cardB).not.toBe("");
    expect(cardB).toBe(cardA);
  } finally {
    await cleanup();
  }
});

test("A's 'next card' rotates the whole room — B sees the same new card", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByRole("button", { name: "load default pool", exact: true }).click();
    await b.waitForTimeout(400);
    await a.getByRole("button", { name: "start", exact: true }).click();
    await b.waitForTimeout(500);

    // Both peers are on round 1 of the same fair-RNG-shuffled deck.
    const firstA = (await a.locator(".cc-card-text").innerText()).trim();
    await expect(b.locator(".cc-card-text")).toHaveText(firstA);
    await expect(a.locator(".cc-status")).toContainText("round 1");
    await expect(b.locator(".cc-status")).toContainText("round 1");

    // Load-bearing cross-peer assertion: peer A advances the deck. The round
    // counter lives in the shared Yjs `state` map, so B (the OPPOSITE peer)
    // must roll to round 2 AND land on the exact same next card A drew — that
    // is the "random prompt-cards rotate the room" claim. A purely local round
    // bump (useState instead of the Yjs doc) would leave B on round 1.
    await a.getByRole("button", { name: "next card", exact: true }).click();
    await expect(a.locator(".cc-status")).toContainText("round 2");
    await expect(b.locator(".cc-status")).toContainText("round 2");

    const secondA = (await a.locator(".cc-card-text").innerText()).trim();
    expect(secondA).not.toBe(firstA); // deck actually advanced
    await expect(b.locator(".cc-card-text")).toHaveText(secondA); // B agrees on the new card
  } finally {
    await cleanup();
  }
});
