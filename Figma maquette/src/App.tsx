import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, limitToLast, query } from 'firebase/database';
import { Thermometer, Droplets, Activity, Clock } from 'lucide-react';

// Configuration Firebase
const firebaseConfig = {
  databaseURL: "https://influx-1117c-default-rtdb.europe-west1.firebasedatabase.app/",
};

// Initialisation
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function App() {
  // Le <any> évite à TypeScript de paniquer car il ne connaît pas la forme exacte des données
  const [telemetry, setTelemetry] = useState<any>(null);

  useEffect(() => {
    // On écoute le dernier message reçu dans le dossier telemetry
    const telemetryRef = query(ref(db, 'telemetry'), limitToLast(1));
    
    const unsubscribe = onValue(telemetryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Firebase renvoie un objet avec un ID unique, on récupère le contenu
        const lastEntry = Object.values(data)[0];
        setTelemetry(lastEntry);
      }
    });

    // Nettoyage de l'écouteur quand on quitte la page
    return () => unsubscribe();
  }, []);

  if (!telemetry) return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Connexion au Cloud Firebase en cours...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ color: '#2c3e50' }}>EdgeBrain Aqua - Dashboard</h1>
        <p style={{ color: '#7f8c8d', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} /> Dernier relevé : {new Date().toLocaleTimeString()}
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        
        {/* Carte Température */}
        <div style={cardStyle}>
          <Thermometer color="#e67e22" size={32} />
          <h3 style={{ margin: '10px 0', color: '#7f8c8d' }}>Température</h3>
          <p style={valueStyle}>{telemetry.sensors_temp?.toFixed(1) || '--'}°C</p>
        </div>

        {/* Carte pH */}
        <div style={cardStyle}>
          <Droplets color="#3498db" size={32} />
          <h3 style={{ margin: '10px 0', color: '#7f8c8d' }}>Niveau pH</h3>
          <p style={valueStyle}>{telemetry.sensors_ph?.toFixed(2) || '--'}</p>
        </div>

        {/* État du Système */}
        <div style={cardStyle}>
          <Activity color={telemetry.relay_state ? "#2ecc71" : "#e74c3c"} size={32} />
          <h3 style={{ margin: '10px 0', color: '#7f8c8d' }}>Pompe / Relais</h3>
          <p style={valueStyle}>{telemetry.relay_state ? "ACTIF" : "ARRÊT"}</p>
        </div>

      </div>

      <footer style={{ marginTop: '40px', fontSize: '0.8em', color: '#bdc3c7', textAlign: 'center' }}>
        Device ID: {telemetry.device_id} | Flotte Aquaculture 4.0
      </footer>
    </div>
  );
}

// Styles en ligne pour éviter d'avoir besoin d'un fichier CSS externe
const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '30px 20px',
  borderRadius: '12px',
  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center'
};

const valueStyle: React.CSSProperties = {
  fontSize: '2.5em',
  fontWeight: 'bold',
  margin: '5px 0 0 0',
  color: '#2c3e50'
};

export default App;