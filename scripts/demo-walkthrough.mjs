/**
 * Precise multi-user Peaksees demo for walkthrough recording.
 * Uses Playwright video capture (more reliable than manual GUI clicking).
 */
import { chromium } from "playwright-core";
import { mkdirSync, renameSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = "/opt/cursor/artifacts/demo-raw";
const FINAL = "/opt/cursor/artifacts/peaksees_multi_user_demo_walkthrough.webm";
mkdirSync(OUT_DIR, { recursive: true });

const USERS = {
  alex: { email: "alex@demo.peaksees", password: "demopass123", name: "Alex" },
  jordan: { email: "jordan@demo.peaksees", password: "demopass123", name: "Jordan" },
  sam: { email: "sam@demo.peaksees", password: "demopass123", name: "Sam" },
};

async function pause(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function hold(page, ms) {
  // Keep the page visually stable for the recording
  await page.mouse.move(640, 400);
  await pause(ms);
}

async function dismissNoise(page) {
  // best-effort dismiss overlays
  await page.keyboard.press("Escape").catch(() => {});
  for (const label of ["Never", "Not now", "Close", "Skip", "Done", "Next"]) {
    const b = page.getByRole("button", { name: label });
    if (await b.count()) {
      await b.first().click({ timeout: 500 }).catch(() => {});
    }
  }
}

async function login(page, user) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await dismissNoise(page);
  await page.locator("#login-email").fill(user.email);
  await page.locator("#login-password").fill(user.password);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL(/\/(feed|dashboard)/, { timeout: 20000 });
  await dismissNoise(page);
  if (page.url().includes("/dashboard")) {
    await page.goto(`${BASE}/feed`, { waitUntil: "networkidle" });
  }
  await pause(800);
}

async function logout(page) {
  await page.request.post(`${BASE}/api/auth/logout`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await pause(500);
}

async function openComposer(page) {
  const fab = page.locator('[data-tour="compose-fab"], button[title="Compose a peak"]').first();
  await fab.click({ timeout: 10000 });
  await page.getByRole("heading", { name: /New post|Write a peak|Compose/i }).waitFor({ timeout: 10000 }).catch(() => {});
  await pause(400);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-gpu",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ["camera", "microphone"],
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
  });
  // Grant media permissions for localhost
  await context.grantPermissions(["camera", "microphone"], { origin: BASE });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  // --- ALEX ---
  await login(page, USERS.alex);
  await openComposer(page);
  const textarea = page.locator("textarea").first();
  await textarea.fill(
    "Speak up: frothy markets, but conviction still pays tonight — who’s with me?",
  );
  // Ensure list-as-market OFF
  const marketSwitch = page.getByRole("switch").first();
  if (await marketSwitch.count()) {
    if (await marketSwitch.isChecked()) await marketSwitch.click();
  }
  await page.getByRole("button", { name: /^Post$/i }).click();
  await pause(1500);
  const showPeaks = page.getByRole("button", { name: /Show latest peaks/i });
  if (await showPeaks.count()) await showPeaks.click();
  await hold(page, 2200);

  // --- JORDAN ---
  await logout(page);
  await login(page, USERS.jordan);
  if (await showPeaks.count()) {
    // re-query after navigation
  }
  const showPeaks2 = page.getByRole("button", { name: /Show latest peaks/i });
  if (await showPeaks2.count()) await showPeaks2.click();
  await pause(600);
  // Open Alex peak card link
  const peakLink = page.locator('a[href*="/u/"][href*="peak="]').first();
  if (await peakLink.count()) {
    await peakLink.click();
    await pause(800);
    await page.getByRole("button", { name: /Open comments|Comments/i }).first().click();
    await pause(400);
    const commentBox = page.getByPlaceholder(/Write a comment/i);
    await commentBox.fill("Bullish — locking YES with you.");
    await page.getByRole("dialog", { name: /Comments/i }).getByRole("button", { name: /^Post$/i }).click();
    await hold(page, 1800);
    await page.getByRole("button", { name: /^Close$/i }).click();
    await pause(500);
  }

  await page.goto(`${BASE}/feed`, { waitUntil: "networkidle" });
  await pause(800);

  // Pick a concrete market id via API so the feed can highlight a stable card
  const markets = await page.evaluate(async () => {
    const res = await fetch("/api/markets?limit=5", { cache: "no-store" });
    return res.json();
  });
  const marketId = markets?.markets?.[0]?.id;
  if (!marketId) throw new Error("No markets available for demo trade");
  await page.goto(`${BASE}/feed?m=${encodeURIComponent(marketId)}`, {
    waitUntil: "networkidle",
  });
  await pause(1200);

  const article = page.locator("article").filter({ hasText: /Buy Yes/i }).first();
  await article.waitFor({ timeout: 20000 });
  await article.scrollIntoViewIfNeeded();
  await article.click({ position: { x: 40, y: 40 } });
  await pause(500);

  // Comment on market
  await article.getByRole("button", { name: /Open comments|Comments/i }).click();
  await pause(500);
  const mComment = page.getByPlaceholder(/Write a comment/i);
  await mComment.fill("Yes this hits — easy bullish YES");
  await page.getByRole("dialog", { name: /Comments/i }).getByRole("button", { name: /^Post$/i }).click();
  await pause(700);
  await mComment.fill("Definitely will happen, no doubt YES");
  await page.getByRole("dialog", { name: /Comments/i }).getByRole("button", { name: /^Post$/i }).click();
  await pause(900);
  await page.getByRole("button", { name: /^Close$/i }).click();
  await pause(500);

  // Trade on same article — keep trade box in view
  const article2 = page.locator("article").filter({ hasText: /Buy Yes/i }).first();
  const buyYes = article2.getByRole("button", { name: /Buy Yes/i });
  await buyYes.scrollIntoViewIfNeeded();
  await hold(page, 900);
  await buyYes.click();
  const bought = page.getByText(/Bought in/i).first();
  await bought.waitFor({ timeout: 15000 });
  await bought.scrollIntoViewIfNeeded();
  await hold(page, 2200);

  // Peak badge on same card
  const badge = article2.getByRole("button", { name: /peaksees|Show Peak|Refresh Peak/i }).first();
  await badge.scrollIntoViewIfNeeded();
  await hold(page, 700);
  await badge.click();
  const dissent = page.getByText(/disagrees with crowd|aligns with crowd/i).first();
  await dissent.waitFor({ timeout: 15000 });
  await dissent.scrollIntoViewIfNeeded();
  // Also ensure Peak % is visible
  await page.getByText(/% YES/i).first().scrollIntoViewIfNeeded().catch(() => {});
  await hold(page, 3200);

  // --- SAM ---
  await logout(page);
  await login(page, USERS.sam);
  await pause(800);

  // Scroll/swipe market cards via keyboard/wheel on marquee
  const viewport = page.locator(".feed-marquee-viewport, [class*='feed-marquee']").first();
  for (let i = 0; i < 3; i++) {
    if (await viewport.count()) {
      await viewport.evaluate((el) => {
        el.scrollBy({ left: el.clientWidth * 0.95, behavior: "smooth" });
      });
    } else {
      await page.mouse.wheel(400, 0);
    }
    await hold(page, 1600);
  }

  // Live
  await page.getByRole("tab", { name: /^Live$/i }).click();
  await hold(page, 1200);
  await page.getByRole("button", { name: /Go live/i }).scrollIntoViewIfNeeded();
  await hold(page, 700);
  await page.getByRole("button", { name: /Go live/i }).click();
  await page.getByText(/CONNECTED/i).waitFor({ timeout: 20000 });
  await page.getByText(/CONNECTED/i).scrollIntoViewIfNeeded();
  await hold(page, 3500);

  await context.close();
  await browser.close();

  // Move recorded webm to final path
  const files = readdirSync(OUT_DIR).filter((f) => f.endsWith(".webm"));
  if (!files.length) throw new Error("No Playwright video produced");
  const src = path.join(OUT_DIR, files[0]);
  renameSync(src, FINAL);
  console.log("Wrote", FINAL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
