# PROJET MASTER : Aquaculture 4.0 - Aquarium Intelligent (Edge AI & Big Data)

## 1. Contexte et Philosophie du Projet
Ce projet est un système industriel de supervision et de régulation pour l'aquaculture. L'architecture a évolué d'un simple système domotique bidirectionnel (contrôle manuel via application web) vers une **architecture "Edge AI" 100% autonome et bidirectionnelle**. 
L'objectif est d'assurer la sécurité vitale des poissons même en cas de perte totale de connectivité réseau (Cloud ou Wi-Fi), tout en permettant une remontée massive des données (Big Data) pour l'analyse scientifique et la maintenance prédictive.

## 2. Architecture Globale du Système (Le Pipeline de Données)
Le flux de données est conçu pour être résilient, évolutif et capable de gérer une flotte d'aquariums :

**[Edge Node : ESP32-S3]** ➔ *(Télémétrie JSON via Wi-Fi)* ➔ **[Broker MQTT : Mosquitto]** ➔ **[Kafka Connect]** ➔ **[Apache Kafka]** ➔ **[Telegraf]** ➔ **[InfluxDB & Firebase]** ➔ **[Visualisation :UI Web]**

### 2.1. Couche 1 : Le Cerveau Périphérique (The Edge Brain - ESP32-S3)
Le microcontrôleur ESP32-S3 est totalement autonome.Mais Il peux reçevoir d'ordres externes (pour commandes manuelles).
*   **Acquisition :** Lecture des capteurs Température (DS18B20), pH (E-201), TDS (SEN0244), Luminosité (LDR HW-072), Ultrason (HC-SR04) et Flotteur de niveau.
*   **Fusion de Capteurs & Sécurité :** L'ESP32 croise les données de l'ultrason et du flotteur. Si un manque d'eau est détecté, un **"Kill-Switch" matériel** coupe instantanément le chauffage et la filtration pour éviter les incendies.
*   **Fail-Safe :** En l'absence de capteur d'oxygène, le système applique un principe de précaution : le bulleur d'oxygène est activé en permanence, ou forcé en cas de dérive de la pollution (TDS) ou du pH.
*   **Horloge Biologique :** L'ESP32 se synchronise via NTP pour simuler le cycle naturel du soleil avec un éclairage LED PWM. Il gère également un distributeur automatique de nourriture (Servomoteur).
*   **TinyML (Intelligence Artificielle) :** Un modèle K-Means (entraîné via Edge Impulse) tourne localement sur l'ESP32. Il analyse les variations multidimensionnelles (Température, pH, TDS) pour générer un `anomaly_score`. Si ce score dépasse 0.5, l'ESP32 ajoute une alerte `IA_DERIVE_DETECTEE` au payload JSON.

### 2.2. Couche 2 : La Passerelle de Données (Raspberry Pi 4B)
Le Raspberry Pi joue le rôle de routeur et d'amortisseur Big Data (sans Docker, pour préserver la RAM). L'ancien script intermédiaire Python (`edge_bridge.py`) a été supprimé au profit d'outils industriels :
*   **Mosquitto (MQTT) :** Reçoit les données de la flotte d'ESP32 sur le port 1883.
*   **Apache Kafka :** Fonctionne en mode **KRaft (Bare-Metal)** sans Zookeeper. La RAM est strictement limitée à 512M (`-Xmx512M -Xms512M`) pour ne pas saturer le Pi.
*   **Kafka Connect (Ingestion) :** Utilise un connecteur source MQTT branché sur le topic wildcard `aquarium/+/telemetry` pour aspirer automatiquement les données de tous les aquariums vers le topic `kafka_telemetry_all`.
*   **Telegraf (Distribution) :** Agit comme le facteur de sortie. Il écoute Kafka (via `kafka_consumer`) et distribue la donnée vers le stockage local (`influxdb_v2`) et vers le Cloud via HTTP (`outputs.http` vers Firebase).

### 2.3. Couche 3 : Stockage et Visualisation (Monitoring)
La supervision a été scindée en deux outils spécifiques pour répondre à deux besoins :
*   **Historique Scientifique (InfluxDB) :** InfluxDB sert de "coffre-fort Time-Series" local.
*   **Temps Réel (Interface Web) :** L'application complexe en React. Il est hébergé via Firebase Hosting et écoute les données directement depuis les CDN de Firebase Database. 

## 3. Détails Techniques & Formats pour l'IA
*L'IA ou le développeur lisant ce document doit respecter ces formats s'il doit modifier le système.*

### 3.1. Structure du Payload JSON (Publié par l'ESP32)
```json
{
  "device_id": "aqua_01",
  "sensors": {
    "temp": 25.4,
    "ph": 7.01,
    "tds": 330.0,
    "lux": 9850,
    "remplissage_pct": 100,
    "flotteur": "NORMAL"
  },
  "actuators": {
    "chauffage": false,
    "filtration": true,
    "oxygene": true,
    "buzzer": false,
    "eclairage_pwm": 255,
    "mode": "AUTO"
  },
  "alertes": ["IA_DERIVE_DETECTEE", "TEMP_TROP_HAUTE"]
}
3.2. Pinout Matériel de l'ESP32-S3 (Prototype Physique)
Ce pinout a été choisi pour sécuriser l'usage du Wi-Fi (utilisation de l'ADC1) et éviter les broches de strapping (qui feraient planter la carte au démarrage).
Capteurs Analogiques (ADC1) :
GPIO 5 : pH (Sonde E-201)
GPIO 6 : TDS (SEN0244)
GPIO 7 : Lumière (Photorésistance LDR HW-072)
Capteurs Numériques & Sécurité :
GPIO 4 : Température (DS18B20 avec résistance Pull-up 4.7kΩ)
GPIO 16 : Flotteur niveau d'eau (Sécurité anti-débordement, INPUT_PULLUP)
GPIO 48 / GPIO 47 : Trig / Echo (Ultrason HC-SR04 pour le calcul du remplissage)
Actionneurs (Relais) :
GPIO 40 : Relais Oxygène (Bulleur / Brassage Fail-Safe)
GPIO 41 : Relais Filtration
GPIO 42 : Relais Chauffage
GPIO 8  : Relais Buzzer (Alerte sonore de sécurité)
Actionneurs Spéciaux (PWM & Multiplexage) :
GPIO 18 : Éclairage LED (Contrôle d'intensité PWM)
GPIO 10 : Servomoteur SG90 (Distributeur de nourriture)
GPIO 15 : Alimentation multiplexée pour le capteur TDS (VCC contrôlé pour éviter la corrosion galvanique de la sonde)
4. Note importante sur le Machine Learning (TinyML)
L'apprentissage du modèle K-Means sur Edge Impulse a été réalisé grâce à la "Stratégie du Faux Poisson". Des dérives contrôlées (ajout de sel pour le TDS, vinaigre pour le pH) ont été injectées dans l'eau claire. Les données d'entraînement ont été extraites de la base InfluxDB à l'aide d'une requête Flux utilisant la fonction pivot() pour aligner temp, ph et tds sous forme de tableau propre [timestamp, temp, ph, tds]. L'algorithme tourne sur l'ESP32 sans quantification (en Float32) grâce au compilateur EON, offrant un temps d'inférence d'environ 1 ms pour moins de 3 Ko de RAM.