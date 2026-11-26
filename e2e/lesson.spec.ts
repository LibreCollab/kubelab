import { readdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

function trackPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (error) => {
    errors.push(error);
  });
  return errors;
}

async function openClusterMap(page: Page): Promise<void> {
  await page.getByTestId("cluster-status").click();
  await expect(page.getByTestId("cluster-map")).toBeVisible();
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
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl run web --image=nginx --labels=app=web");
  await page.keyboard.press("Enter");
  await page.keyboard.type("kubectl get pod web");
  await page.keyboard.press("Enter");
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

test("brand mark returns to the roadmap", async ({ page }) => {
  await page.goto("/lesson/containers-101");
  await page.getByRole("link", { name: /Kubelab/ }).click();
  await expect(page).toHaveURL(/\/$/);
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
  await page.goto("/lesson/kcna-readiness");

  await expect(page.getByRole("heading", { name: "KCNA readiness" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause clock" })).toHaveCount(0);
  await expect(page.getByTestId("terminal-panel")).toHaveCount(0);
  await expect(page.locator('[data-check="Pod definition"]')).toHaveAttribute(
    "data-state",
    "pending",
  );

  await page.getByLabel("The smallest deployable unit").check();
  await page.getByLabel("kube-scheduler").check();
  await page.getByLabel("Kubernetes and cloud native fundamentals").check();

  await expect(page.locator('[data-check="Pod definition"]')).toHaveAttribute("data-state", "pass");
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
  await expect(page.getByRole("button", { name: "Pause clock" })).toHaveCount(0);
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
  await openClusterMap(page);
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
  await expect(page.getByRole("button", { name: "Pause clock" })).toHaveCount(0);
  await expect(page.getByTestId("cluster-status")).toBeVisible();
  await expect(page.getByTestId("cluster-status")).toHaveAttribute("data-pods", "0");

  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl create deployment web --image=nginx --replicas=3");
  await page.keyboard.press("Enter");
  await expect(terminalOutput).toContainText("deployment.apps/web created");
  await expect(page.locator('[data-check="Created the Deployment"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.getByTestId("cluster-status")).toHaveAttribute("data-pods", "3");

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
    { timeout: 10_000 },
  );
  await expect(page.getByTestId("cluster-status")).toHaveAttribute("data-pods", "5", {
    timeout: 15_000,
  });
  await openClusterMap(page);
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

  await expect(page.getByTestId("cluster-status")).toHaveAttribute("data-running", "2");

  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get endpoints web");
  await page.keyboard.press("Enter");
  await expect(terminalOutput).toContainText("10.244.0.");
  await openClusterMap(page);
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

  await expect(page.getByTestId("cluster-status")).toHaveAttribute("data-running", "3");

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

  await expect(page.getByTestId("cluster-status")).toHaveAttribute("data-running", "3");

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
  await openClusterMap(page);
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

  await expect(page.getByTestId("cluster-status")).toHaveAttribute("data-running", "2");

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
  await openClusterMap(page);
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

  await expect(page.getByTestId("cluster-status")).toHaveAttribute("data-running", "1");

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
  await openClusterMap(page);
  await expect(page.getByTestId("cluster-secret-db-secret")).toBeVisible();
  await expect(page.getByTestId("cluster-secret-db-secret")).not.toContainText("s3cr3t");
  expect(pageErrors).toEqual([]);
});

test("mutating commands open a replayable cluster scene", async ({ page }) => {
  await page.goto("/lesson/pods-101");

  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl run web --image=nginx --labels=app=web");
  await page.keyboard.press("Enter");

  const scene = page.getByTestId("cluster-scene");
  await expect(scene).toBeVisible();
  await expect(scene).toContainText("run web --image=nginx");
  await expect(scene.getByRole("button", { name: "Replay" })).toBeVisible();

  await scene.getByRole("button", { name: "Open full map" }).click();
  await expect(scene).toHaveCount(0);
  await expect(page.getByTestId("cluster-map")).toBeVisible();
});

test("read-only commands do not open the cluster scene", async ({ page }) => {
  await page.goto("/lesson/nodes-101");

  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get nodes");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("cluster-scene")).toHaveCount(0);
});

test("container and control-plane lessons are interactive", async ({ page }) => {
  const pageErrors = trackPageErrors(page);

  await page.goto("/lesson/images-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl run web --image=nginx:1.27");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-check="Ran a tagged image"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await page.keyboard.type("kubectl describe pod web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("nginx:1.27");

  await page.goto("/lesson/control-plane-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get pods -n kube-system");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("etcd-node-1");
  await page.keyboard.type("kubectl describe pod etcd-node-1 -n kube-system");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("Running");
  await page.keyboard.type("kubectl get nodes");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("node-1");
  expect(pageErrors).toEqual([]);
});

test("hands-on certification lab starts and reviews tasks", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lab-exam/cka");

  await expect(page.getByRole("heading", { name: "CKA lab" })).toBeVisible();
  await expect(page.getByText("15 tasks", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start lab" }).click();
  await expect(page.getByRole("button", { name: /^Task 1 / })).toBeVisible();
  await expect(page.getByText("Page 1 of 3")).toBeVisible();
  await expect(page.locator(".xterm-screen")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 3 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Submit lab exam" }).click();
  await expect(page.getByText("Not passed")).toBeVisible();
  await expect(page.getByText("Review ready")).toBeVisible();
  await expect(page.getByText("0%")).toBeVisible();
  await expect(page.locator("[data-correct]").first()).toBeVisible();
  await page.getByRole("link", { name: "Practice missed questions" }).click();
  await expect(page.getByText("CKA hands-on")).toBeVisible();

  await page.goto("/certification/cka");
  await expect(page.getByText("Readiness trend")).toBeVisible();
  await expect(page.getByText("Trend starts after your next session")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("certification roadmaps map domains and readiness", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/certification/kcna");

  await expect(page.getByRole("heading", { name: "KCNA" })).toBeVisible();
  await expect(page.getByText("Readiness", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kubernetes fundamentals" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start knowledge exam →" })).toBeVisible();

  await page.goto("/certification/cka");
  await expect(page.getByRole("heading", { name: "CKA" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workloads and scheduling" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start hands-on exam →" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("hands-on-only exam routes to the lab runner", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/exam/cka");

  await expect(page.getByRole("heading", { name: "CKA" })).toBeVisible();
  await expect(page.getByText("Hands-on only")).toBeVisible();
  await page.getByRole("link", { name: "Start hands-on exam" }).click();
  await expect(page.getByRole("heading", { name: "CKA lab" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("certification mock exam starts, submits, and reviews", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/exam/kcna");

  await expect(page.getByRole("heading", { name: "KCNA" })).toBeVisible();
  await expect(page.getByText("60 questions", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start exam" }).click();
  await expect(page.getByText("Answered 0 / 60")).toBeVisible();
  await expect(page.getByText(/Page 1 of 6/)).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText(/Page 2 of 6/)).toBeVisible();
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByText(/Page 1 of 6/)).toBeVisible();
  for (let pageNumber = 1; pageNumber < 6; pageNumber += 1) {
    await page.getByRole("button", { name: "Next page" }).click();
  }
  await expect(page.getByText(/Page 6 of 6/)).toBeVisible();
  await page.getByRole("button", { name: "Submit exam" }).click();
  await expect(page.getByText("Not passed")).toBeVisible();
  await expect(page.getByText(/Page 1 of 6/)).toBeVisible();
  await expect(page.getByText("0/60 correct")).toBeVisible();
  await expect(page.getByRole("link", { name: "Practice missed questions" })).toBeVisible();
  await page.getByRole("link", { name: "Practice missed questions" }).click();
  await expect(page.getByRole("heading", { name: "Practice queue" })).toBeVisible();
  await expect(page.getByText("60 due")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("practice queue renders when empty", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/practice");
  await expect(page.getByRole("heading", { name: "Practice queue" })).toBeVisible();
  await expect(page.getByText("Nothing due right now")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("toolchain lessons expose Helm, Kustomize, GitOps, and CRDs", async ({ page }) => {
  const pageErrors = trackPageErrors(page);

  await page.goto("/lesson/helm-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("helm list");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("nginx-15.4.0");
  await page.keyboard.type("helm status web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("STATUS: deployed");
  await page.keyboard.type("helm history web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("Upgrade complete");
  await page.keyboard.type("helm upgrade web ./chart --set replicas=5");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-check="Upgraded the release"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await page.keyboard.type("helm rollback web 1");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-check="Rolled back the release"]')).toHaveAttribute(
    "data-state",
    "pass",
  );

  await page.goto("/lesson/kustomize-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl kustomize base");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("replicas: 1");
  await page.keyboard.type("kubectl kustomize overlays/prod");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("replicas: 3");
  await page.keyboard.type("kubectl apply -k overlays/prod");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-check="Applied the overlay"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(page.locator('[data-check="Prod Deployment is active"]')).toHaveAttribute(
    "data-state",
    "pass",
    { timeout: 6_000 },
  );

  await page.goto("/lesson/gitops-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("argocd app list");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("OutOfSync");
  await page.keyboard.type("argocd app get web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("deploy/web");
  await page.keyboard.type("argocd app sync web");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-check="Synced the application"]')).toHaveAttribute(
    "data-state",
    "pass",
  );

  await page.goto("/lesson/operators-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get widgets");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("web");
  await page.keyboard.type("kubectl describe widgets web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("green");
  expect(pageErrors).toEqual([]);
});

test("storage lessons expose PVC and StorageClass state", async ({ page }) => {
  const pageErrors = trackPageErrors(page);

  await page.goto("/lesson/persistent-volumes-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get pvc data");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("Bound");
  await page.keyboard.type("kubectl describe pvc data");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("data-pv");
  await page.keyboard.type("kubectl get pod db -o wide");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("10.244.0.21");

  await page.goto("/lesson/storageclasses-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get storageclass fast");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("fast");
  await page.keyboard.type("kubectl describe pvc cache");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("fast");
  expect(pageErrors).toEqual([]);
});

test("workload and governance lessons are interactive", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.goto("/lesson/jobs-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get jobs");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("migrate");
  await expect(page.locator('[data-check="Listed the Job"]')).toHaveAttribute("data-state", "pass");
  await page.keyboard.type("kubectl describe job migrate");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-check="Read the Job"]')).toHaveAttribute("data-state", "pass");

  await page.goto("/lesson/statefulsets-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get statefulsets");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("db");
  await expect(page.locator('[data-check="Listed the StatefulSet"]')).toHaveAttribute(
    "data-state",
    "pass",
  );
  expect(pageErrors).toEqual([]);
});

test("scheduling and autoscaling lessons explain placement", async ({ page }) => {
  const pageErrors = trackPageErrors(page);

  await page.goto("/lesson/scheduling-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get nodes --show-labels");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("disk=ssd");
  await page.keyboard.type("kubectl describe node node-2");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("dedicated=db:NoSchedule");
  await page.keyboard.type("kubectl get pods -o wide");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("node-2");

  await page.goto("/lesson/autoscaling-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get hpa web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("web");
  await page.keyboard.type("kubectl describe hpa web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("desiredReplicas");
  expect(pageErrors).toEqual([]);
});

test("network lessons expose Pod IPs and policy selectors", async ({ page }) => {
  const pageErrors = trackPageErrors(page);

  await page.goto("/lesson/cni-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get pods -o wide");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("10.244.1.10");
  await page.keyboard.type("kubectl describe pod api");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("10.244.2.11");

  await page.goto("/lesson/network-policy-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get networkpolicy");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("deny-all");
  await page.keyboard.type("kubectl describe networkpolicy deny-all");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("podSelector");
  expect(pageErrors).toEqual([]);
});

test("security lessons expose RBAC and Pod hardening", async ({ page }) => {
  const pageErrors = trackPageErrors(page);

  await page.goto("/lesson/rbac-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get serviceaccount deploy-bot");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("deploy-bot");
  await page.keyboard.type("kubectl describe role pod-reader");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("pods");
  await page.keyboard.type(
    "kubectl auth can-i get pods --as=system:serviceaccount:default:deploy-bot",
  );
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("yes");

  await page.goto("/lesson/pod-security-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl describe namespace secure");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("pod-security.kubernetes.io/enforce");
  await page.keyboard.type("kubectl describe pod web -n secure");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("runAsNonRoot=true");
  expect(pageErrors).toEqual([]);
});

test("observability lessons expose logs, events, and readiness", async ({ page }) => {
  const pageErrors = trackPageErrors(page);

  await page.goto("/lesson/logs-events-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl logs web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("listening on :8080");
  await page.keyboard.type("kubectl get events");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("Started container web");
  await page.keyboard.type("kubectl logs web -f");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("listening on :8080");
  await expect(page.locator(".xterm-rows")).toContainText("following logs");
  await page.keyboard.press("Control+c");
  await page.keyboard.type("kubectl get pods");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("web");

  await page.goto("/lesson/probes-101");
  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl get pod web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("0/1");
  await page.keyboard.type("kubectl describe pod web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("readiness probe failed");
  await page.keyboard.type("kubectl get endpoints web");
  await page.keyboard.press("Enter");
  await expect(page.locator(".xterm-rows")).toContainText("<none>");
  await openClusterMap(page);
  await expect(page.locator('[data-map-pod][data-state="not-ready"]')).toHaveCount(1);
  await expect(page.getByTestId("cluster-service-web")).toHaveAttribute("data-endpoints", "0");
  expect(pageErrors).toEqual([]);
});

test("cluster status opens and closes the inspector", async ({ page }) => {
  await page.goto("/lesson/pods-101");

  const status = page.getByTestId("cluster-status");
  await expect(status).toBeVisible();
  await expect(page.getByTestId("cluster-map")).toHaveCount(0);

  await status.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cluster-map")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close cluster state" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("cluster-map")).toHaveCount(0);
  await expect(status).toBeFocused();
});

test("cluster status stays visible while scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/lesson/deployments-101");

  const status = page.getByTestId("cluster-status");
  await expect(status).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(status).toBeVisible();
});

test("cluster map fits a mobile lesson", async ({ page }) => {
  const pageErrors = trackPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lesson/deployments-101");

  await page.locator(".xterm-screen").click();
  await page.keyboard.type("kubectl create deployment web --image=nginx --replicas=1");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("cluster-status")).toBeVisible();
  await expect(page.getByTestId("cluster-status")).toHaveAttribute("data-pods", "1", {
    timeout: 15_000,
  });
  await openClusterMap(page);
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

test("every lesson route renders without runtime errors", async ({ page }) => {
  test.setTimeout(120_000);
  const lessonIds = readdirSync("packages/content/lessons")
    .filter((file) => file.endsWith(".yaml"))
    .map((file) => file.slice(0, -".yaml".length));

  expect(lessonIds.length).toBeGreaterThanOrEqual(40);

  for (const lessonId of lessonIds) {
    const errors: Error[] = [];
    const onError = (error: Error) => errors.push(error);
    page.on("pageerror", onError);

    await page.goto(`/lesson/${lessonId}`);
    await expect(page.getByRole("heading", { level: 1 }), lessonId).toBeVisible();
    await expect(page.getByText("Lesson not found"), lessonId).toHaveCount(0);
    await expect(page.getByText("Lesson complete"), lessonId).toHaveCount(0);
    expect(errors, lessonId).toEqual([]);

    page.off("pageerror", onError);
  }
});

test("every lesson has no serious accessibility violations", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const lessonIds = readdirSync("packages/content/lessons")
    .filter((file) => file.endsWith(".yaml"))
    .map((file) => file.slice(0, -".yaml".length));

  for (const lessonId of lessonIds) {
    await page.goto(`/lesson/${lessonId}`);
    await page.waitForTimeout(100);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, `${lessonId}: ${serious.map((violation) => violation.id).join(", ")}`).toEqual(
      [],
    );
  }
});

test("running knowledge exam passes accessibility and mobile checks", async ({ page }) => {
  await page.goto("/exam/kcna");
  await page.getByRole("button", { name: "Start exam" }).click();
  await expect(page.getByText("Answered 0 / 60")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => violation.id).join(", ")).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("running lab exam passes accessibility and mobile checks", async ({ page }) => {
  await page.goto("/lab-exam/cka");
  await page.getByRole("button", { name: "Start lab" }).click();
  await expect(page.getByRole("button", { name: /Task 1 / }).first()).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => violation.id).join(", ")).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("knowledge review passes accessibility and mobile checks", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/exam/kcna");
  await page.getByRole("button", { name: "Start exam" }).click();
  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("button", { name: "Next page" }).click();
  }
  await page.getByRole("button", { name: "Submit exam" }).click();
  await expect(page.getByText("Not passed")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => violation.id).join(", ")).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("lab review passes accessibility and mobile checks", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/lab-exam/cka");
  await page.getByRole("button", { name: "Start lab" }).click();
  for (let index = 0; index < 2; index += 1) {
    await page.getByRole("button", { name: "Next page" }).click();
  }
  await page.getByRole("button", { name: "Submit lab exam" }).click();
  await expect(page.getByText("Not passed")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious, serious.map((violation) => violation.id).join(", ")).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
});

test("populated practice and roadmap states pass accessibility checks", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/exam/kcna");
  await page.getByRole("button", { name: "Start exam" }).click();
  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("button", { name: "Next page" }).click();
  }
  await page.getByRole("button", { name: "Submit exam" }).click();
  await expect(page.getByText("Not passed")).toBeVisible();

  for (const route of ["/practice", "/certification/kcna"]) {
    await page.goto(route);
    await page.waitForTimeout(100);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, `${route}: ${serious.map((violation) => violation.id).join(", ")}`).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
      route,
    ).toBe(false);
  }
});

test("key pages have no serious accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of [
    "/",
    "/lesson/containers-101",
    "/exam/kcna",
    "/lab-exam/cka",
    "/certification/kcna",
  ]) {
    await page.goto(route);
    await page.waitForTimeout(200);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, `${route}: ${serious.map((violation) => violation.id).join(", ")}`).toEqual([]);
  }
});
