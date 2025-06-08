// seed-players.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://hziakntcegkkdwqownrf.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6aWFrbnRjZWdra2R3cW93bnJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNDM1MjUsImV4cCI6MjA2NDcxOTUyNX0.6RkPQ_X0ImNGaxKi6x_q9bVwVeDrxogi9tZb3tcUaAk"
);

const players = [
  { names: "Breilyn", lastnames: "Valdez", cedula: "40240946448" },
  { names: "Jorge", lastnames: "Fernandez", cedula: "40230864494" },
  { names: "Brian", lastnames: "Del Pilar", cedula: "40215316056" },
  { names: "Jeremy", lastnames: "Devers", cedula: "40218276174" },
  { names: "Xiolin", lastnames: "Ramírez", cedula: "40233984380" },
  { names: "Angel", lastnames: "Martinez", cedula: "40200751770" },
  { names: "Richard", lastnames: "Almengo", cedula: "40218357164" },
  { names: "Manuel", lastnames: "Medina", cedula: "40230496669" },
  { names: "Geny", lastnames: "Fernandez", cedula: "40229705591" },
  { names: "Rafael", lastnames: "Almonte", cedula: "40233896725" },
  { names: "Juan Carlos", lastnames: "Borissova", cedula: "40200624605" },
  { names: "Victor", lastnames: "Veloz", cedula: "40209499850" },
  { names: "Jhoan", lastnames: "Santos", cedula: "40212393454" },
  { names: "Jesús", lastnames: "Aquino", cedula: "40234036651" },
  { names: "Angel", lastnames: "Mojica", cedula: "40200456024" },
  { names: "Diego", lastnames: "Paula", cedula: "40210537862" },
  { names: "Cristopher", lastnames: "Herasme", cedula: "40209991765" },
  { names: "Manny", lastnames: "Alexander", cedula: "22300741943" },
  { names: "Darwin", lastnames: "Capellan", cedula: "40212605063" },
  { names: "Kevin", lastnames: "Rodriguez", cedula: "40236901035" },
  { names: "Cristopher", lastnames: "Gonzalez", cedula: "40211890013" },
  { names: "Robert", lastnames: "Batista", cedula: "40236156887" },
  { names: "Angel Rafael", lastnames: "López Durán", cedula: "40200714455" },
  { names: "John Manuel", lastnames: "Rodríguez Marion", cedula: "40200674543" },
  { names: "Elías", lastnames: "Calderon De La Cruz", cedula: "40229764549" },
  { names: "Francis", lastnames: "Tavera", cedula: "40240532552" },
  { names: "Alberto", lastnames: "Lorenzo", cedula: "40215330503" },
  { names: "Carlos", lastnames: "Lorenzo", cedula: "40231547825" },
  { names: "Jean Carlos", lastnames: "Hernandez", cedula: "40200660385" },
  { names: "Emmanuel", lastnames: "Guillen Beltran", cedula: "40208752259" },
  { names: "Hector Angel", lastnames: "Mateo", cedula: "40200396592" },
  { names: "Moises", lastnames: "Ramirez", cedula: "40232060554" },
  { names: "David", lastnames: "Arias", cedula: "40229395781" },
  { names: "Jose", lastnames: "Valdez", cedula: "40214968170" },
  { names: "Carlos", lastnames: "Caseres", cedula: null },
  { names: "Victor", lastnames: "Aybar", cedula: null },
  { names: "Raymer", lastnames: "Calderon", cedula: null },
  { names: "Danilo", lastnames: "Soto Araujo", cedula: null }
];

for (const player of players) {
  player.backjerseyname = player.names.split(" ")[0]; // o como prefieras
  player.jerseynumber = null;
  player.description = null;
  player.photo = null;
}

const run = async () => {
  const { data, error } = await supabase.from("players").insert(players);
  if (error) {
    console.error("Error al insertar:", error.message);
  } else {
    console.log("Jugadores insertados correctamente:", data);
  }
};

run();
