import { PrismaClient } from "@prisma/client/extension";
import { log } from "console";

export const prisma = new PrismaClient({
  log: ['query']
});