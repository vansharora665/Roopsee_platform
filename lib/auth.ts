import { prisma } from "@/lib/db/prisma";

export async function getCurrentUser() {
  const demoEmail = process.env.DEMO_USER_EMAIL ?? "doctor@roopsee.local";

  return prisma.user.findUnique({
    where: {
      email: demoEmail
    }
  });
}
