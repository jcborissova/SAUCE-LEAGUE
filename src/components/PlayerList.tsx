// src/components/PlayerList.tsx
import React, { useState } from "react";

interface Player {
  id: number;
  name: string;
  number: number;
  description: string;
}

const PlayerList: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayer, setNewPlayer] = useState({ name: "", number: "", description: "" });

  const handleAddPlayer = () => {
    if (!newPlayer.name || !newPlayer.number) return;
    setPlayers([
      ...players,
      {
        id: Date.now(),
        name: newPlayer.name,
        number: parseInt(newPlayer.number),
        description: newPlayer.description,
      },
    ]);
    setNewPlayer({ name: "", number: "", description: "" });
  };

  const handleDeletePlayer = (id: number) => {
    setPlayers(players.filter(player => player.id !== id));
  };

  return (
    <div className="space-y-4 p-4 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold">Lista de Jugadores</h2>

      {/* Formulario para agregar jugador */}
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="Nombre"
          className="p-2 border rounded"
          value={newPlayer.name}
          onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="Número"
          className="p-2 border rounded"
          value={newPlayer.number}
          onChange={(e) => setNewPlayer({ ...newPlayer, number: e.target.value })}
        />
        <input
          type="text"
          placeholder="Descripción"
          className="p-2 border rounded"
          value={newPlayer.description}
          onChange={(e) => setNewPlayer({ ...newPlayer, description: e.target.value })}
        />
        <button onClick={handleAddPlayer} className="px-4 py-2 bg-yellow-500 text-white rounded">
          Agregar
        </button>
      </div>

      {/* Lista de jugadores */}
      <div className="space-y-2">
        {players.length === 0 ? (
          <p className="text-gray-500">No hay jugadores.</p>
        ) : (
          players.map((player) => (
            <div key={player.id} className="flex items-center justify-between p-2 bg-gray-100 rounded">
              <div>
                <p className="font-bold">{player.name} - #{player.number}</p>
                <p className="text-sm text-gray-600">{player.description}</p>
              </div>
              <button
                onClick={() => handleDeletePlayer(player.id)}
                className="text-red-500 hover:text-red-700"
              >
                Eliminar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PlayerList;
    