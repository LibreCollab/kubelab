import { expect, type Page, test } from "@playwright/test";

function trackPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (error) => {
    errors.push(error);
  });
  return errors;
}

test("roadmap lesson lists align at the top", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const offsets = await page.locator("article").evaluateAll((cards) => {
    return cards.slice(0, 4).map((card) => {
      const list = card.querySelector('[data-testid^="unit-lessons-"]');
      if (list === null) {
        return Number.NaN;
      }
      return list.getBoundingClientRect().top - card.getBoundingClientRect().top;
    });
  });

  expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThan(2);
});

test("progress persists and unlocks the next lesson", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/");

  const summary = page.getByTestId("progress-summary");
  await expect(summary).toHaveAttribute("data-completed", "0");
  await expect(page.locator('[data-lesson-id="images-101"]')).toHaveAttribute(
    "data-state",
    "locked",
  );

  await page.getByRole("link", { name: "Start the first lesson", exact: true }).click();
  await page.getByLabel("An image is the template; a container is a running instance").check();

  await expect(page.getByText("Lesson complete")).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("An image is the template; a container is a running instance"),
  ).toBeChecked();
  await expect(page.getByText("Lesson complete")).toBeVisible();

  await page.goto("/");
  await expect(summary).toHaveAttribute("data-completed", "1");
  await expect(summary).toHaveAttribute("data-xp", "10");
  await expect(summary).toHaveAttribute("data-streak", "1");
  await expect(page.locator('[data-lesson-id="images-101"]')).toHaveAttribute(
    "data-state",
    "current",
  );

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Reset progress" }).click();
  await expect(summary).toHaveAttribute("data-completed", "0");
  expect(pageErrors).toEqual([]);
});

test("brand mark starts the first lesson", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Kubelab — start the first lesson/ }).click();
  await expect(page).toHaveURL(/\/lesson\/containers-101$/);
});

test("landing page navigates into the first lesson", async ({ page }) => {
  const pageErrors = trackPageErrors(page);

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Learn Kubernetes by running it." }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Start the first lesson", exact: true }).click();

  await expect(page).toHaveURL(/\/lesson\/containers-101$/);
  await expect(page.getByRole("heading", { name: "Containers, images, and Pods" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("roadmap exposes core units and certification tracks", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Core roadmap" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Certification tracks" })).toBeVisible();
  await expect(page.getByRole("article", { name: /Unit 12:/ })).toBeVisible();
  await expect(page.getByRole("article", { name: "KCNA certification track" })).toBeVisible();
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

test("command-only lessons hide the clock controls", async ({ page }) => {
  await page.goto("/lesson/nodes-101");

  await expect(page.getByRole("button", { name: "Pause clock" })).toHaveCount(0);
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get nodes");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("node-1");
});

test("terminal creates a pod and the checkpoint passes", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/pods-101");

  const terminalOutput = page.locator(".xterm-rows");
  await expect(terminalOutput).toContainText("Kubelab simulated cluster");
  await expect(page.getByRole("button", { name: "Pause clock" })).toBeVisible();
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
  await expect(page.getByTestId("cluster-standalone-pods")).toBeVisible();
  await expect(page.locator('[data-map-pod][data-state="running"]')).toHaveCount(1);
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

test("deployment lesson runs a scale and image rollout", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/deployments-101");

  const terminalOutput = page.locator(".xterm-rows");
  await expect(page.getByRole("button", { name: "Pause clock" })).toBeVisible();
  await expect(page.getByTestId("cluster-map")).toBeVisible();
  await expect(page.getByTestId("cluster-node-node-1")).toBeVisible();
  await expect(page.getByTestId("cluster-map")).toHaveAttribute("data-pods", "0");

  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl create deployment web --image=nginx --replicas=3");
  await page.keyboard.press("Enter");
  await expect(terminalOutput).toContainText("deployment.apps/web created");
  await expect(page.locator('[data-check="Created the Deployment"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.getByTestId("cluster-deployment-web")).toBeVisible();
  await expect(page.locator('[data-object="replicaset"]')).toHaveCount(1);

  await page.keyboard.type("kubectl scale deployment web --replicas=5");
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl set image deployment/web nginx=nginx:1.27");
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl rollout status deployment/web");
  await page.keyboard.press("Enter");

  await expect(page.locator('[data-check="Scaled the Deployment"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-check="Updated the image"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-check="Checked the rollout"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-check="Deployment scaled and updated"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.getByTestId("cluster-deployment-web")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("[data-map-pod]")).toHaveCount(5);
  await expect(page.locator('[data-map-pod][data-state="running"]')).toHaveCount(5);
  await expect(page.locator('[data-object="replicaset"]')).toHaveCount(2);
  await expect(page.locator('[data-object="replicaset"][data-state="retired"]')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});

test("service lesson exposes a deployment and shows endpoints", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/services-101");

  const terminalOutput = page.locator(".xterm-rows");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl create deployment web --image=nginx --replicas=2");
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl expose deployment web --port=80");
  await page.keyboard.press("Enter");

  await expect(terminalOutput).toContainText("service/web exposed");
  await expect(page.locator('[data-check="Exposed the Deployment"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-check="ClusterIP Service exists"]')).toHaveAttribute(
    "data-state",
    "pass",
  );

  await page.getByRole("button", { name: "Pause clock" }).click();
  await page.getByRole("button", { name: "Step" }).click();
  await page.getByRole("button", { name: "Step" }).click();

  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get endpoints web");
  await page.keyboard.press("Enter");
  await expect(terminalOutput).toContainText("10.244.0.");
  await expect(page.getByTestId("cluster-service-web")).toHaveAttribute("data-endpoints", "2");
  expect(pageErrors).toEqual([]);
});

test("DNS lesson resolves a Service from a Pod", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/dns-101");

  const terminalOutput = page.locator(".xterm-rows");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl create deployment web --image=nginx --replicas=2 -n demo");
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl expose deployment web --port=80 -n demo");
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl run client --image=busybox -n demo");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Pause clock" }).click();
  await page.getByRole("button", { name: "Step" }).click();
  await page.getByRole("button", { name: "Step" }).click();
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl exec client -n demo -- nslookup web");
  await page.keyboard.press("Enter");

  await expect(terminalOutput).toContainText("web.demo.svc.cluster.local");
  await expect(page.locator('[data-check="Resolved web from the client"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  expect(pageErrors).toEqual([]);
});

test("Ingress lesson routes a request through a Service", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/ingress-101");

  const terminalOutput = page.locator(".xterm-rows");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl create deployment web --image=nginx --replicas=2 -n demo");
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl expose deployment web --port=80 -n demo");
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl run client --image=busybox -n demo");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Pause clock" }).click();
  await page.getByRole("button", { name: "Step" }).click();
  await page.getByRole("button", { name: "Step" }).click();
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl create ingress web --rule=shop.example.com/=web:80 -n demo");
  await page.keyboard.press("Enter");
  await page.keyboard.type(
    'kubectl exec client -n demo -- curl -H "Host: shop.example.com" http://shop.example.com/',
  );
  await page.keyboard.press("Enter");

  await expect(terminalOutput).toContainText("HTTP/1.1 200 OK");
  await expect(page.locator('[data-check="Host routes to web"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-check="Tested the route with curl"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.getByTestId("cluster-ingress-web")).toBeVisible();
  await expect(page.getByTestId("cluster-map")).toHaveAttribute("data-ingresses", "1");
  expect(pageErrors).toEqual([]);
});

test("ConfigMap lesson injects env into a Deployment", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/configmaps-101");

  await page.locator(".xterm-screen").click();
  await page.keyboard.type(
    "kubectl create configmap app-config --from-literal=APP_MODE=production --from-literal=LOG_LEVEL=debug",
  );
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl create deployment web --image=nginx --replicas=2");
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl set env deployment/web --from=configmap/app-config");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Pause clock" }).click();
  await page.getByRole("button", { name: "Step" }).click();
  await page.getByRole("button", { name: "Step" }).click();

  await expect(page.locator('[data-check="ConfigMap has app settings"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-check="APP_MODE is injected"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-check="Deployment is ready"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.getByTestId("cluster-configmap-app-config")).toBeVisible();
  await expect(page.getByTestId("cluster-configmap-app-config")).toHaveAttribute("data-keys", "2");
  expect(pageErrors).toEqual([]);
});

test("Secret lesson injects a redacted value into a Deployment", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/secrets-101");

  await page.locator(".xterm-screen").click();
  await page.keyboard.type(
    "kubectl create secret generic db-secret --from-literal=DB_PASSWORD=s3cr3t",
  );
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl create deployment api --image=nginx --replicas=1");
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl set env deployment/api --from=secret/db-secret");
  await page.keyboard.press("Enter");

  await page.getByRole("button", { name: "Pause clock" }).click();
  await page.getByRole("button", { name: "Step" }).click();
  await page.getByRole("button", { name: "Step" }).click();

  await expect(page.locator('[data-check="Secret contains DB_PASSWORD"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-check="DB_PASSWORD is injected"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-check="Deployment is ready"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.getByTestId("cluster-secret-db-secret")).toBeVisible();
  await expect(page.getByTestId("cluster-secret-db-secret")).not.toContainText("s3cr3t");
  expect(pageErrors).toEqual([]);
});

test("cluster map fits a mobile lesson", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lesson/deployments-101");

  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl create deployment web --image=nginx --replicas=1");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("cluster-map")).toBeVisible();
  await expect(page.getByTestId("cluster-deployment-web")).toBeVisible();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
  expect(pageErrors).toEqual([]);
});

test("landing page fits a mobile viewport", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: "Start the first lesson", exact: true }),
  ).toBeVisible();

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
