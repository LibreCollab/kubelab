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

  await expect(page).toHaveURL(/\/lesson\/containers-101$/);
  await expect(page.getByRole("heading", { name: "Containers, images, and Pods" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("roadmap exposes core units and certification tracks", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Core roadmap" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Certification tracks" })).toBeVisible();
  await expect(page.getByRole("article", { name: /Unit 12:/ })).toBeVisible();

  await page.getByRole("link", { name: /KCNA readiness/ }).click();
  await expect(page).toHaveURL(/\/lesson\/kcna-readiness$/);
  await expect(page.getByRole("heading", { name: "KCNA readiness" })).toBeVisible();
});

test("knowledge checks complete a theory lesson", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/containers-101");

  await expect(page.getByRole("heading", { name: "Containers, images, and Pods" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause clock" })).toHaveCount(0);
  await expect(page.getByTestId("terminal-panel")).toHaveCount(0);
  await expect(page.locator('[data-check="Image vs container"]')).toHaveAttribute(
    "data-state",
    "pending",
  );

  await page.getByLabel("An image is the template; a container is a running instance").check();

  await expect(page.locator('[data-check="Image vs container"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-feedback="pass"]')).toBeVisible();
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
  await expect(page.locator('[data-check="Image is nginx"]')).toHaveAttribute("data-state", "pass");
  await expect(page.locator('[data-check="Phase is Running"]')).toHaveAttribute(
    "data-state",
    "pass",
    { timeout: 6_000 },
  );
  await expect(page.locator('[data-check="Run kubectl get pods"]')).toHaveAttribute(
    "data-state",
    "pending",
  );
  await expect(page.locator('[data-feedback="pending"]')).toContainText("Run kubectl get pods");

  await page.keyboard.type("kubectl get pods");
  await page.keyboard.press("Enter");
  await expect(terminalOutput).toContainText("Running");
  await expect(page.locator('[data-check="Run kubectl get pods"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-feedback="pass"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("a mistyped label is rejected before creating the pod", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/pods-101");

  const terminalOutput = page.locator(".xterm-rows");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl run web --image=nginx --labels=app=kur");
  await page.keyboard.press("Enter");

  await expect(terminalOutput).toContainText("lesson requirements not met");
  await expect(terminalOutput).toContainText("label app=web (got app=kur)");
  await expect(terminalOutput).not.toContainText("pod/web created");

  await expect(page.locator('[data-check="Pod web exists"]')).toHaveAttribute(
    "data-state",
    "pending",
  );
  await expect(page.locator('[data-check="Label app=web"]')).toHaveAttribute(
    "data-state",
    "pending",
  );
  await expect(page.locator('[data-feedback="pending"]')).toHaveAttribute(
    "data-next-check",
    "Pod web exists",
  );
  expect(pageErrors).toEqual([]);
});

test("a wrong image is rejected before creating the pod", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/pods-101");

  const terminalOutput = page.locator(".xterm-rows");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl run web --image=httpd --labels=app=web");
  await page.keyboard.press("Enter");

  await expect(terminalOutput).toContainText("image nginx (got httpd)");
  await expect(terminalOutput).not.toContainText("pod/web created");
  await expect(page.locator('[data-check="Pod web exists"]')).toHaveAttribute(
    "data-state",
    "pending",
  );
  await expect(page.locator('[data-check="Image is nginx"]')).toHaveAttribute(
    "data-state",
    "pending",
  );
  await expect(page.locator('[data-feedback="pending"]')).toHaveAttribute(
    "data-next-check",
    "Pod web exists",
  );
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

test("terminal supports paste and cursor editing", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/pods-101");

  const terminalOutput = page.locator(".xterm-rows");
  await page.locator(".xterm-screen").click();

  await page.keyboard.insertText("kubectl get podx");
  await expect(terminalOutput).toContainText("kubectl get podx");

  await page.keyboard.press("Backspace");
  await page.keyboard.press("Home");
  await page.keyboard.type("x");
  await expect(terminalOutput).toContainText("xkubectl get pod");

  await page.keyboard.press("Control+A");
  await page.keyboard.press("Control+K");
  await page.keyboard.type("kubectl get nodes");
  await page.keyboard.press("Enter");
  await expect(terminalOutput).toContainText("node-1");
  expect(pageErrors).toEqual([]);
});

test("terminal recalls command history with ArrowUp", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/pods-101");

  const terminalOutput = page.locator(".xterm-rows");
  await expect(terminalOutput).toContainText("Kubelab simulated cluster");

  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get nodes");
  await page.keyboard.press("Enter");
  await expect(terminalOutput).toContainText("node-1");

  await page.keyboard.press("ArrowUp");
  await expect
    .poll(async () => {
      const text = await terminalOutput.textContent();
      return text?.match(/kubectl get nodes/g)?.length ?? 0;
    })
    .toBeGreaterThanOrEqual(2);

  await page.keyboard.press("Enter");

  await expect
    .poll(async () => {
      const text = await terminalOutput.textContent();
      return text?.match(/node-1/g)?.length ?? 0;
    })
    .toBeGreaterThanOrEqual(2);
  expect(pageErrors).toEqual([]);
});

test("terminal stays sticky while the lesson scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto("/lesson/pods-101");

  const panel = page.getByTestId("terminal-panel");
  await expect(panel).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(100);
  const first = await panel.boundingBox();

  await page.evaluate(() => window.scrollTo(0, 350));
  await page.waitForTimeout(100);
  const second = await panel.boundingBox();

  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  if (first !== null && second !== null) {
    expect(Math.abs(second.y - first.y)).toBeLessThan(2);
    expect(second.y).toBeLessThan(100);
  }
});

test("API health check is reachable through the dev proxy", async ({ request }) => {
  const response = await request.get("/api/healthz");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "ok", service: "kubelab-api" });
});
