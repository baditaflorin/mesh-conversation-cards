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

    const cardA = (await a.locator(".cc-card").innerText()).trim();
    const cardB = (await b.locator(".cc-card").innerText()).trim();
    if (cardA !== cardB) throw new Error("disagree: " + cardA + " vs " + cardB);
  } finally {
    await cleanup();
  }
});
