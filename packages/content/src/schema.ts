import { z } from "zod";

export const podCheckSchema = z.object({
  type: z.literal("pod"),
  label: z.string().min(1),
  namespace: z.string().min(1).default("default"),
  name: z.string().min(1).optional(),
  labels: z.record(z.string(), z.string()).default({}),
  phase: z.enum(["Pending", "Running", "Succeeded", "Failed"]).optional(),
});

export const checkSchema = podCheckSchema;

export const lessonSpecSchema = z.object({
  id: z.string().min(1),
  unit: z.string().min(1),
  title: z.string().min(1),
  xp: z.number().int().positive(),
  prereqs: z.array(z.string()).default([]),
  theory: z.string().min(1),
  scenario: z.object({
    nodes: z
      .array(
        z.object({
          name: z.string().min(1),
          cpu: z.string().optional(),
          memory: z.string().optional(),
        }),
      )
      .min(1),
    objects: z.array(z.unknown()).default([]),
  }),
  objectives: z.array(z.string().min(1)).min(1),
  checks: z.array(checkSchema).min(1),
  hints: z.array(z.string()).default([]),
  solution: z.string().min(1),
});

export type LessonSpec = z.infer<typeof lessonSpecSchema>;
export type LessonCheck = z.infer<typeof checkSchema>;

export interface Lesson extends LessonSpec {
  theoryMarkdown: string;
}
