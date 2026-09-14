"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "./password";
import { setSessionCookie, clearSessionCookie, getSession } from "./current-session";
import { recordAudit } from "@/lib/core/audit";
import { isUserRole } from "@/lib/core/roles";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;
  const genericError = "Invalid email or password";

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { company: true },
  });

  if (!user || !user.isActive || !user.company.isActive) {
    return { error: genericError };
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    return { error: genericError };
  }

  if (!isUserRole(user.role)) {
    return { error: "Account role is misconfigured. Contact your administrator." };
  }

  await setSessionCookie({
    userId: user.id,
    companyId: user.companyId,
    companyName: user.company.name,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await recordAudit({
    companyId: user.companyId,
    userId: user.id,
    action: "LOGIN_SUCCESS",
    entityType: "User",
    entityId: user.id,
  });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    await recordAudit({
      companyId: session.companyId,
      userId: session.userId,
      action: "LOGOUT",
      entityType: "User",
      entityId: session.userId,
    });
  }
  await clearSessionCookie();
  redirect("/login");
}
