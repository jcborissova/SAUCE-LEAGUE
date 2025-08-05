import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Tournament } from "../../types/tournament";

const TournamentList: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const loadTournaments = async () => {
    const { data, error } = await supabase.from("tournaments").select("*").order("start_date", { ascending: false });
    if (!error) setTournaments(data);
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-blue-950 mb-4">Torneos Registrados</h2>
      {tournaments.map((t) => (
        <div key={t.id} className="bg-white p-4 rounded-xl shadow-md">
          <div className="font-semibold text-blue-900">{t.name}</div>
          <div className="text-sm text-gray-500">Inicio: {t.start_date}</div>
        </div>
      ))}
    </div>
  );
};

export default TournamentList;
