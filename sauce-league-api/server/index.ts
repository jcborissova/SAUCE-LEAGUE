import express from "express";
import cors from "cors";
import { playerRouter } from "./routes/players.js";
import { PrismaClient } from "@prisma/client";

const app = express();
const PORT = process.env.PORT || 3001;

const prisma = new PrismaClient();

async function startServer() {
  try {
    // Esto aplicará las migraciones si no están aplicadas aún
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Player" (
        id SERIAL PRIMARY KEY,
        names TEXT NOT NULL,
        lastnames TEXT NOT NULL,
        backJerseyName TEXT NOT NULL,
        jerseyNumber INT NOT NULL,
        cedula TEXT NOT NULL,
        description TEXT NOT NULL,
        photo TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT now()
      );
    `);

    app.use(cors());
    app.use(express.json());
    app.use("/api/players", playerRouter);

    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server", err);
  }
}

startServer();
