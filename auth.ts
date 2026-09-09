import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEFAULT_VENDOR_SLUG } from "@/lib/rbac";
import { getLicenseStatus } from "@/lib/license";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        vendorSlug: { label: "Lab ID", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const vendorSlug = String(credentials?.vendorSlug ?? DEFAULT_VENDOR_SLUG)
          .trim()
          .toLowerCase() || DEFAULT_VENDOR_SLUG;
        if (!email || !password) return null;

        const vendor = await prisma.vendor.findFirst({ where: { slug: vendorSlug } });
        if (!vendor) return null;

        const user = await prisma.user.findUnique({
          where: { vendorId_email: { vendorId: vendor.id, email } },
        });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const license = await getLicenseStatus(vendor.id, { refreshMs: 1200 });
        if (!license.writable) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
          vendorId: user.vendorId,
          vendorSlug: vendor.slug,
        } as never;
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        const u = user as {
          role?: string;
          branchId?: string | null;
          id?: string;
          vendorId?: string;
          vendorSlug?: string;
        };
        token.role = u.role;
        token.branchId = u.branchId;
        token.id = u.id;
        token.vendorId = u.vendorId;
        token.vendorSlug = u.vendorSlug;
      }
      if (token.id && !token.vendorId) {
        try {
          const row = await prisma.user.findUnique({
            where: { id: String(token.id) },
            include: { vendor: { select: { slug: true } } },
          });
          if (row) {
            token.role = row.role;
            token.branchId = row.branchId;
            token.vendorId = row.vendorId;
            token.vendorSlug = row.vendor.slug;
          }
        } catch {
          /* Don't fail the request if the lab database is busy during backup. */
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        const s = session.user as {
          role?: unknown;
          branchId?: unknown;
          id?: unknown;
          vendorId?: unknown;
          vendorSlug?: unknown;
        };
        s.role = token.role;
        s.branchId = token.branchId;
        s.id = token.id;
        s.vendorId = token.vendorId;
        s.vendorSlug = token.vendorSlug;
      }
      return session;
    },
  },
});
