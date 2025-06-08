// bulk-insert.ts
import fetch from "node-fetch";

const players = [
  { names: "Xiolin", lastnames: "Ramírez", cedula: "402-3398438-0" },
  { names: "Angel", lastnames: "Martinez", cedula: "402-0075177-0" },
  { names: "Richard", lastnames: "Almengo", cedula: "402-1835716-4" },
  { names: "Manuel", lastnames: "Medina", cedula: "402-3049666-9" },
  { names: "Geny", lastnames: "Fernandez", cedula: "402-2970559-1" },
  { names: "Rafael", lastnames: "Almonte", cedula: "402-3389672-5" },
  { names: "Juan Carlos", lastnames: "Borissova", cedula: "402-0062460-5" },
  { names: "Victor", lastnames: "Veloz", cedula: "402-0949985-0" },
  { names: "Jhoan", lastnames: "Santos", cedula: "402-1239345-4" },
  { names: "Jesús", lastnames: "Aquino", cedula: "402-3403665-1" },
  { names: "Angel", lastnames: "Mojica", cedula: "402-0045602-4" },
  { names: "Diego", lastnames: "Paula", cedula: "402-1053786-2" },
  { names: "Cristopher", lastnames: "Herasme", cedula: "402-0999176-5" },
  { names: "Manny", lastnames: "Alexander", cedula: "223-0074194-3" },
  { names: "Darwin", lastnames: "Capellan", cedula: "402-1260506-3" },
  { names: "Kevin", lastnames: "Rodriguez", cedula: "402-3690103-5" },
  { names: "Cristopher", lastnames: "Gonzalez", cedula: "402-1189001-3" },
  { names: "Robert", lastnames: "Batista", cedula: "402-3615688-7" },
  { names: "Angel Rafael", lastnames: "López Durán", cedula: "402-0071445-5" },
  { names: "John Manuel", lastnames: "Rodríguez Marion", cedula: "402-0067454-3" },
  { names: "Elías", lastnames: "Calderon De La Cruz", cedula: "402-2976454-9" },
  { names: "Francis", lastnames: "Tavera", cedula: "402-4053255-2" },
  { names: "Alberto", lastnames: "Lorenzo", cedula: "402-1533050-3" },
  { names: "Carlos", lastnames: "Lorenzo", cedula: "402-3154782-5" },
  { names: "Jean Carlos", lastnames: "Hernandez", cedula: "402-0066038-5" },
  { names: "Emmanuel", lastnames: "Guillen Beltran", cedula: "402-0875225-9" },
  { names: "Hector Angel", lastnames: "Mateo", cedula: "402-0039659-2" },
  { names: "Moises", lastnames: "Ramirez", cedula: "402-3206055-4" },
  { names: "David", lastnames: "Arias", cedula: "402-2939578-1" },
  { names: "Jose", lastnames: "Valdez", cedula: "402-1496817-0" },
  { names: "Carlos", lastnames: "Caseres", cedula: "" },
  { names: "Victor", lastnames: "Aybar", cedula: "" },
  { names: "Raymer", lastnames: "Calderon", cedula: "" },
  { names: "Danilo", lastnames: "Soto Araujo", cedula: "" },
];

const run = async () => {
  for (const p of players) {
    const response = await fetch("http://localhost:3001/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        names: p.names,
        lastnames: p.lastnames,
        cedula: p.cedula,
        backjerseyname: "",
        jerseynumber: 0,
        description: "Pendiente",
        photo: ""
      }),
    });

    const result = await response.json() as { names: string; lastnames: string };
    if (response.ok) {
      console.log(`✅ Insertado: ${result.names} ${result.lastnames}`);
    } else {
      console.log(`❌ Error con: ${p.names} ${p.lastnames}`, result);
    }
  }
};

run();
