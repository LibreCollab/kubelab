import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";

import { RootLayout } from "./routes/__root";
import { HomePage } from "./routes/index";

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const lessonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lesson/$lessonId",
  component: lazyRouteComponent(() => import("./routes/lesson.$lessonId"), "LessonPage"),
});

const certificationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/certification/$trackId",
  component: lazyRouteComponent(
    () => import("./routes/certification.$trackId"),
    "CertificationRoadmapPage",
  ),
});

const examRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exam/$trackId",
  component: lazyRouteComponent(() => import("./routes/exam.$trackId"), "ExamPage"),
});

const labExamRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lab-exam/$trackId",
  component: lazyRouteComponent(() => import("./routes/lab-exam.$trackId"), "LabExamPage"),
});

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/practice",
  component: lazyRouteComponent(() => import("./routes/practice"), "PracticePage"),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  lessonRoute,
  certificationRoute,
  examRoute,
  labExamRoute,
  practiceRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
