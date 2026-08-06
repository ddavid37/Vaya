// Extend Auth.js Session/JWT types with driverId.

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    driverId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    driverId?: string;
  }
}
