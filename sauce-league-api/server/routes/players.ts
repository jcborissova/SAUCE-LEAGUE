import express from "express";
import { PrismaClient } from "@prisma/client";

export const playerRouter = express.Router();
const prisma = new PrismaClient();

// GET all players
playerRouter.get("/", async (req, res) => {
  try {
    const players = await prisma.player.findMany({ orderBy: { createdAt: "desc" } });
    res.json(players);
  } catch (error) {
    console.error("GET /players failed", error);
    res.status(500).json({ error: "Failed to fetch players" });
  }
});

// POST new player
playerRouter.post("/", async (req, res) => {
  const {
    names,
    lastnames,
    backJerseyName,
    jerseyNumber,
    cedula,
    description,
    photo,
  } = req.body;

  try {
    const newPlayer = await prisma.player.create({
      data: {
        names,
        lastnames,
        backJerseyName,
        jerseyNumber: parseInt(jerseyNumber),
        cedula,
        description,
        photo,
      },
    });
    res.status(201).json(newPlayer);
  } catch (error) {
    console.error("POST /players failed", error);
    res.status(500).json({ error: "Failed to create player" });
  }
});

// PUT update player
playerRouter.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    names,
    lastnames,
    backJerseyName,
    jerseyNumber,
    cedula,
    description,
    photo,
  } = req.body;

  try {
    const updated = await prisma.player.update({
      where: { id: parseInt(id) },
      data: {
        names,
        lastnames,
        backJerseyName,
        jerseyNumber: parseInt(jerseyNumber),
        cedula,
        description,
        photo,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error("PUT /players failed", error);
    res.status(500).json({ error: "Failed to update player" });
  }
});

// DELETE player
playerRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.player.delete({ where: { id: parseInt(id) } });
    res.status(204).end();
  } catch (error) {
    console.error("DELETE /players failed", error);
    res.status(500).json({ error: "Failed to delete player" });
  }
});
