import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .pipe(z.email({ message: "Enter a valid email address" }));

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters")
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/\d/, "Password must contain a digit"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(200),
});
