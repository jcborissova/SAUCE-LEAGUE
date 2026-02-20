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
      <h2 className="text-xl font-bold mb-4">Torneos Registrados</h2>
      {tournaments.map((t) => (
        <div key={t.id} className="app-card p-4 rounded-xl">
          <div className="font-semibold">{t.name}</div>
          <div className="text-sm text-[hsl(var(--text-subtle))]">Inicio: {t.start_date}</div>
        </div>
      ))}
    </div>
  );
};

export default TournamentList;
