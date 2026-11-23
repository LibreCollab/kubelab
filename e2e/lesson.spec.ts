import { expect, type Page, test } from "@playwright/test";

function trackPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (error) => {
    errors.push(error);
  });
  return errors;
}

test("landing page navigates into the first lesson", async ({ page }) => {
  const pageErrors = trackPageErrors(page);

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Learn Kubernetes by running it." }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Start the first lesson" }).click();

  await expect(page).toHaveURL(/\/lesson\/pods-101$/);
  await expect(page.getByRole("heading", { name: "Your first Pod" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("terminal creates a pod and the checkpoint passes", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/pods-101");

  const terminalOutput = page.locator(".xterm-rows");
  await expect(terminalOutput).toContainText("Kubelab simulated cluster");
  await expect(page.locator('[data-check="Phase is Running"]')).toHaveAttribute(
    "data-state",
    "pending",
  );

  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl run web --image=nginx --labels=app=web");
  await page.keyboard.press("Enter");

  await expect(terminalOutput).toContainText("pod/web created");
  await expect(page.locator('[data-check="Pod web exists"]')).toHaveAttribute("data-state", "pass");
  await expect(page.locator('[data-check="Label app=web"]')).toHaveAttribute("data-state", "pass");
  await expect(page.locator('[data-check="Phase is Running"]')).toHaveAttribute(
    "data-state",
    "pass",
    { timeout: 6_000 },
  );

  await page.keyboard.type("kubectl get pods");
  await page.keyboard.press("Enter");
  await expect(terminalOutput).toContainText("Running");
  expect(pageErrors).toEqual([]);
});

test("landing page fits a mobile viewport", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Start the first lesson" })).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  expect(pageErrors).toEqual([]);
});

test("API health check is reachable through the dev proxy", async ({ request }) => {
  const response = await request.get("/api/healthz");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "ok", service: "kubelab-api" });
});
