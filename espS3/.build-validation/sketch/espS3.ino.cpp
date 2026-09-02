#include <Arduino.h>
#line 1 "C:\\Users\\storm\\Desktop\\projetkio\\espS3\\espS3.ino"
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ESP32Servo.h> 
#include "time.h"

// ==========================================
// INCLUSION DE LA BIBLIOTHÈQUE TINYML (K-MEANS)
// ⚠️ Vérifiez que le nom correspond exactement à votre fichier .zip
// ==========================================
#include <K-mean_inferencing.h>

// ==========================================
// 1. CONFIGURATION RÉSEAU & MQTT
// ==========================================
const String DEVICE_ID = "aqua_01"; 
String telemetry_topic = "aquarium/" + DEVICE_ID + "/telemetry";
String command_topic = "aquarium/" + DEVICE_ID + "/command";

const char* ssid = "ssd";
const char* password = "11110000";
const char* mqtt_server = "192.168.137.228";

const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 3600;  
const int   daylightOffset_sec = 0;

WiFiClient espClient;
PubSubClient client(espClient);

// ==========================================
// 2. BROCHES ESP32-S3 (100% SÉCURISÉES)
// ==========================================
#define PIN_TEMP       4  

// --- PINS ANALOGIQUES (ADC1) ---
#define PIN_PH         5  
#define PIN_TDS        6  
#define PIN_LDR        7  

// --- PINS DIGITAUX ET PWM ---
#define PIN_FLOTTEUR_HAUT 16   
#define PIN_TRIG       48     
#define PIN_ECHO       47     

#define PIN_REL_OXYGENE 40    
#define PIN_REL_FILTRE  41    
#define PIN_REL_CHAUFFE 42    

#define PIN_REL_BUZZER  8     
#define PIN_ECLAIRAGE   18    

// --- PIN SERVO ET ALIMENTATION DU CAPTEUR TDS ---
#define PIN_SERVO       10        
#define PIN_ALIM_TDS    15    

OneWire oneWire(PIN_TEMP);
DallasTemperature ds18b20(&oneWire);
Servo distributeur;

// ==========================================
// 3. SEUILS DE RÉGULATION ET D'ALERTE
// ==========================================
const float SEUIL_TEMP_MIN  = 24.0;
const float SEUIL_TEMP_MAX  = 26.0;
const float SEUIL_TEMP_MIN2 = 20.0; 
const float SEUIL_TEMP_MAX2 = 30.0; 

const float SEUIL_PH_MIN  = 6.5;
const float SEUIL_PH_MAX  = 7.5;
const float SEUIL_PH_MIN2 = 6.0; 
const float SEUIL_PH_MAX2 = 8.0; 

const float SEUIL_TDS_MAX = 400.0;
const float SEUIL_TDS_MAX2= 600.0; 

const float DISTANCE_EAU_PLEIN = 20.0;  
const float DISTANCE_EAU_VIDE  = 50.0; 

// ==========================================
// VARIABLES GLOBALES (Système)
// ==========================================
unsigned long lastMsg = 0;
const long INTERVALLE_ENVOI = 5000;
bool alarme_critique = false;
int intensite_led = 0;
bool urgence_buzzer = false;

unsigned long last_mqtt_attempt = 0;
const long MQTT_RECONNECT_INTERVAL = 5000;
const uint16_t MQTT_SOCKET_TIMEOUT_SECONDS = 10;

unsigned long wifi_attempt_started = 0;
unsigned long last_wifi_attempt_finished = 0;
const long WIFI_CONNECT_TIMEOUT = 10000;
const long WIFI_RECONNECT_INTERVAL = 5000;
bool wifi_attempt_in_progress = false;
bool wifi_was_connected = false;

bool kill_switch_active = false;
int index_alerte = 0;
const char* alertes[10]; 

bool mode_auto = true;  

bool repas_matin_donne = false;
bool repas_soir_donne = false;
int dernier_jour_nourrissage = -1;
int temps_repas = 0; 
bool nourrissage_actif = false;
unsigned long nourrissage_actif_jusqua = 0;

// Filtres moyenneurs
const int NUM_LECTURES_PH = 10;
float lectures_ph[NUM_LECTURES_PH];
int index_ph = 0;
bool premier_tour_ph = true;

const int NUM_LECTURES_TDS = 10;
float lectures_tds[NUM_LECTURES_TDS];
int index_tds = 0;
bool premier_tour_tds = true;

// ==========================================
// VARIABLES GLOBALES (TinyML / IA)
// ==========================================
const int FENETRE_TINYML = 12;
float hist_ph[FENETRE_TINYML];
float hist_tds[FENETRE_TINYML];
float hist_temp[FENETRE_TINYML];
int index_ml = 0;
bool buffer_ml_pret = false;

float score_anomalie = 0.0;

// Sécurité de compilation pour l'IA
static_assert(EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE == FENETRE_TINYML * 3, 
              "Erreur: la taille du buffer TinyML ne correspond pas au modèle Edge Impulse");

struct ManualActuators {
  bool chauffage = false;
  bool filtration = false;
  bool oxygene = false;
  bool buzzer = false;
  bool feeder = false;
  int eclairage_pwm = 0;
};
ManualActuators manual_actuators;
unsigned long last_command_received = 0;
const long COMMAND_TIMEOUT = 30000;

// ==========================================
// FONCTIONS ANNEXES
// ==========================================
float lireUltrason() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 30000);
  if (duration == 0) return -1.0;
  return (duration * 0.0343) / 2.0;
}

void gererEclairageNaturel() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo, 20)) return;

  float heure_decimale = timeinfo.tm_hour + (timeinfo.tm_min / 60.0);

  if (heure_decimale >= 8.0 && heure_decimale <= 18.0) intensite_led = 255;
  else if (heure_decimale > 6.0 && heure_decimale < 8.0) intensite_led = (int)(((heure_decimale - 6.0) / 2.0) * 255);
  else if (heure_decimale > 18.0 && heure_decimale < 20.0) intensite_led = (int)(((20.0 - heure_decimale) / 2.0) * 255);
  else intensite_led = 0;

  ledcWrite(PIN_ECLAIRAGE, intensite_led);
}

void logEvent(const char* event, const char* details = "") {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo, 20)) {
    if (strlen(details) > 0) Serial.printf("[??:??:??] [%s] %s\n", event, details);
    else Serial.printf("[??:??:??] [%s]\n", event);
    return;
  }
  if (strlen(details) > 0) {
    Serial.printf("[%02d:%02d:%02d] [%s] %s\n", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec, event, details);
  } else {
    Serial.printf("[%02d:%02d:%02d] [%s]\n", timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec, event);
  }
}

// ==========================================
// GESTION DU NOURRISSAGE AUTOMATIQUE
// ==========================================
void actionnerTrappe() {
  logEvent("NOURRISSAGE", "Distribution en cours...");
  nourrissage_actif = true;
  distributeur.write(120); 
  delay(500);             
  distributeur.write(0);  
  nourrissage_actif_jusqua = millis() + 2500;
}

void gererNourrissage() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo, 20)) return;

  int heure = timeinfo.tm_hour;
  int minute = timeinfo.tm_min;
  int jour_courant = timeinfo.tm_year * 366 + timeinfo.tm_yday;

  // Detecte le changement de date meme si aucun cycle n'a lieu a minuit.
  if (jour_courant != dernier_jour_nourrissage) {
    repas_matin_donne = false;
    repas_soir_donne = false;
    dernier_jour_nourrissage = jour_courant;
  }

  if (mode_auto && !kill_switch_active) {
    if (heure == 9 && minute == 00 && !repas_matin_donne) {
      temps_repas = 1; 
      actionnerTrappe();
      repas_matin_donne = true;
    }
    
    if (heure == 17 && minute == 55 && !repas_soir_donne) {
      temps_repas = 1; 
      actionnerTrappe();
      repas_soir_donne = true;
    }
  }
}

void appliquerArretUrgence() {
  digitalWrite(PIN_REL_CHAUFFE, LOW);
  digitalWrite(PIN_REL_FILTRE, LOW);
  digitalWrite(PIN_REL_OXYGENE, LOW);
  ledcWrite(PIN_ECLAIRAGE, 0);
  distributeur.write(0);
  nourrissage_actif = false;
  temps_repas = 0;
  manual_actuators.feeder = false;
}

// ==========================================
// CALLBACK MQTT (ÉCOUTE DES COMMANDES)
// ==========================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char message[length + 1];
  for (unsigned int i = 0; i < length; i++) {
    message[i] = (char)payload[i];
  }
  message[length] = '\0';
  
  if (String(topic) != command_topic) return;

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) return;

  // Commande independante du mode : {"kill_switch": true|false}
  if (doc.containsKey("kill_switch")) {
    if (!doc["kill_switch"].is<bool>()) {
      logEvent("KILL_SWITCH_ERROR", "Valeur MQTT invalide");
      return;
    }

    bool nouvel_etat = doc["kill_switch"].as<bool>();
    if (nouvel_etat != kill_switch_active) {
      kill_switch_active = nouvel_etat;
      logEvent("KILL_SWITCH", kill_switch_active ? "ARRET D'URGENCE ACTIF" : "Arret d'urgence leve");
    }

    if (kill_switch_active) {
      appliquerArretUrgence();
      alarme_critique = true;
    }
  }

  const char* mode = doc["mode"];
  if (mode == NULL) return;

  if (strcmp(mode, "AUTO") == 0) {
    mode_auto = true;
    logEvent("MODE_CHANGE", "Basculé en AUTO");
  }
  else if (strcmp(mode, "MANUAL") == 0) {
    mode_auto = false;
    last_command_received = millis();
    logEvent("MODE_CHANGE", "Basculé en MANUAL");

    JsonObject actuators = doc["actuators"];
    if (!actuators.isNull()) {
      manual_actuators.chauffage = actuators["chauffage"] | false;
      manual_actuators.filtration = actuators["filtration"] | false;
      manual_actuators.oxygene = actuators["oxygene"] | false;
      manual_actuators.buzzer = actuators["buzzer"] | false;
      manual_actuators.feeder = actuators["feeder"] | false;
      manual_actuators.eclairage_pwm = actuators["eclairage_pwm"] | 0;
    }

  }
}

void demarrerConnexionWiFi(bool reconnexion) {
  wifi_attempt_started = millis();
  wifi_attempt_in_progress = true;

  if (reconnexion) {
    WiFi.reconnect();
    logEvent("WIFI_WARN", "Tentative de reconnexion...");
  } else {
    WiFi.begin(ssid, password);
    logEvent("WIFI_INFO", "Tentative de connexion...");
  }
}

bool handleWiFi() {
  unsigned long now = millis();

  if (WiFi.status() == WL_CONNECTED) {
    if (!wifi_was_connected) {
      wifi_was_connected = true;
      wifi_attempt_in_progress = false;
      logEvent("WIFI_CONNECTED", WiFi.localIP().toString().c_str());
    }
    return true;
  }

  if (wifi_was_connected) {
    wifi_was_connected = false;
    client.disconnect();
    demarrerConnexionWiFi(true);
    return false;
  }

  if (wifi_attempt_in_progress) {
    if (now - wifi_attempt_started < WIFI_CONNECT_TIMEOUT) return false;

    WiFi.disconnect();
    wifi_attempt_in_progress = false;
    last_wifi_attempt_finished = now;
    logEvent("WIFI_TIMEOUT", "Connexion impossible, fonctionnement hors ligne");
    return false;
  }

  if (now - last_wifi_attempt_finished >= WIFI_RECONNECT_INTERVAL) {
    demarrerConnexionWiFi(false);
  }

  return false;
}

bool handleMQTT() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) return false;
  
  if (!client.connected()) {
    if (now - last_mqtt_attempt >= MQTT_RECONNECT_INTERVAL) {
      last_mqtt_attempt = now;
      logEvent("MQTT_WARN", "Reconnexion au Broker...");

      if (client.connect(DEVICE_ID.c_str())) {
        logEvent("MQTT_CONNECTED", "Broker reconnecté ✓");
        client.subscribe(command_topic.c_str());
      }
    }
    return false;
  }
  client.loop();
  return true;
}

// ==========================================
// LECTURE ET RÉGULATION LOCALE
// ==========================================
void readSensorsAndRegulate() {
  unsigned long now = millis();
  
  if (!mode_auto && (now - last_command_received >= COMMAND_TIMEOUT)) {
    mode_auto = true;
    logEvent("MODE_TIMEOUT", "Retour à AUTO");
  }

  temps_repas = 0; 
  if (nourrissage_actif && millis() > nourrissage_actif_jusqua) {
    nourrissage_actif = false;
  }

  if (mode_auto && !kill_switch_active) gererEclairageNaturel();
  gererNourrissage(); 

  // --- GESTION DU NOURRISSAGE MANUEL ---
  if (!mode_auto && !kill_switch_active && manual_actuators.feeder) {
    temps_repas = 1;
    actionnerTrappe();
    manual_actuators.feeder = false;
  }

  ds18b20.requestTemperatures();
  float temp = ds18b20.getTempCByIndex(0);
  bool temperature_valide = (temp != DEVICE_DISCONNECTED_C);
  if (!temperature_valide) digitalWrite(PIN_REL_CHAUFFE, LOW);
  int flotteur_brut = digitalRead(PIN_FLOTTEUR_HAUT);
  float distance_eau_cm = lireUltrason();
  int raw_ldr = analogRead(PIN_LDR);

  // ==============================================================
  // --- MULTIPLEXAGE TEMPOREL DU TDS (ÉVITE LA BOUCLE DE MASSE) ---
  // ==============================================================
  
  // ÉTAPE 1 : Le capteur TDS est ÉTEINT, on lit le pH
  digitalWrite(PIN_ALIM_TDS, LOW); 
  delay(100); 
  int raw_ph = analogRead(PIN_PH);    
  
  // ÉTAPE 2 : On allume le TDS, on attend sa stabilisation, puis lecture
  digitalWrite(PIN_ALIM_TDS, HIGH);   
  delay(200);                                                       
  int raw_tds = analogRead(PIN_TDS);  
  
  // ÉTAPE 3 : Extinction immédiate du TDS pour protéger le cycle
  digitalWrite(PIN_ALIM_TDS, LOW);    

  // ==============================================================
  // ➔ INTÉGRATION DE VOTRE NOUVELLE CALIBRATION EN 2 POINTS (pH)
  // ==============================================================
  
  // 1. Calcul de la tension brute reçue sur la broche ADC (0 à 3.3V)
  float voltage_adc_ph = (raw_ph / 4095.0) * 3.3;
  
  // 2. Reconstruction de la tension avant votre pont diviseur 10k/20k
  float voltage_module_ph = voltage_adc_ph / (20000.0 / 30000.0); 

  // 3. Application de VOTRE équation sur-mesure (Pente: -5.81 | Zéro: 2.623V)
  float ph_instantane = 7.00 + (-5.81) * (voltage_module_ph - 2.623); 

  // 4. Bornage de sécurité strict
  if (ph_instantane < 0.0) ph_instantane = 0.0;
  if (ph_instantane > 14.0) ph_instantane = 14.0;

  // --- FILTRE MOYENNEUR GLISSANT pH ---
  if (premier_tour_ph) {
    for (int i = 0; i < NUM_LECTURES_PH; i++) lectures_ph[i] = ph_instantane;
    premier_tour_ph = false;
  } else {
    lectures_ph[index_ph] = ph_instantane;
    index_ph = (index_ph + 1) % NUM_LECTURES_PH;
  }
  float somme_ph = 0;
  for (int i = 0; i < NUM_LECTURES_PH; i++) somme_ph += lectures_ph[i];
  float ph = somme_ph / NUM_LECTURES_PH;

  // --- CONVERSION ET FILTRE MOYENNEUR TDS ---
  float voltage_tds = (raw_tds / 4095.0) * 3.3;
  float temp_pour_compensation = temperature_valide ? temp : 25.0; 
  float compensationCoefficient = 1.0 + 0.02 * (temp_pour_compensation - 25.0);
  float compensationVoltage = voltage_tds / compensationCoefficient;
  float tds_instantane = (133.42 * pow(compensationVoltage, 3) - 255.86 * pow(compensationVoltage, 2) + 857.39 * compensationVoltage) * 0.5 - 52;
  if (tds_instantane < 0.0) tds_instantane = 0.0;

  if (premier_tour_tds) {
    for (int i = 0; i < NUM_LECTURES_TDS; i++) lectures_tds[i] = tds_instantane;
    premier_tour_tds = false;
  } else {
    lectures_tds[index_tds] = tds_instantane;
    index_tds = (index_tds + 1) % NUM_LECTURES_TDS;
  }
  float somme_tds = 0;
  for (int i = 0; i < NUM_LECTURES_TDS; i++) somme_tds += lectures_tds[i];
  float tds = somme_tds / NUM_LECTURES_TDS;

  // --- AUTRES CAPTEURS ---
  float lux = map(raw_ldr, 0, 4095, 10000, 0);

  int pourcentage_eau = 0;
  if (distance_eau_cm > 0) {
    float pct = ((DISTANCE_EAU_VIDE - distance_eau_cm) / (DISTANCE_EAU_VIDE - DISTANCE_EAU_PLEIN)) * 100.0;
    if (pct > 100.0) pct = 100.0; 
    if (pct < 0.0) pct = 0.0;     
    pourcentage_eau = (int)pct;
  }

  String etat_flotteur = (flotteur_brut == 1) ? "NORMAL" : "BAS";

  index_alerte = 0;
  urgence_buzzer = false;

  // --- SÉCURITÉ CRITIQUE STANDARD ---
  if (temperature_valide) {
    if (temp < SEUIL_TEMP_MIN2) {
      urgence_buzzer = true;
      if (index_alerte < 10) alertes[index_alerte++] = "TEMP_CRITIQUE_BASSE";
    } else if (temp > SEUIL_TEMP_MAX2) {
      urgence_buzzer = true;
      if (index_alerte < 10) alertes[index_alerte++] = "TEMP_CRITIQUE_HAUTE";
    }
  } else {
    urgence_buzzer = true;
    if (index_alerte < 10) alertes[index_alerte++] = "SONDE_TEMP_DECONNECTEE";
  }

  if (ph < SEUIL_PH_MIN2) {
    urgence_buzzer = true;
    if (index_alerte < 10) alertes[index_alerte++] = "PH_CRITIQUE_ACIDE";
  } else if (ph > SEUIL_PH_MAX2) {
    urgence_buzzer = true;
    if (index_alerte < 10) alertes[index_alerte++] = "PH_CRITIQUE_BASIQUE";
  }

  if (tds > SEUIL_TDS_MAX2) {
    urgence_buzzer = true;
    if (index_alerte < 10) alertes[index_alerte++] = "TDS_TROP_HAUT";
  }

  if (pourcentage_eau <= 20 && etat_flotteur == "BAS") {
    urgence_buzzer = true;
    if (index_alerte < 10) alertes[index_alerte++] = "NIVEAU_EAU_CRITIQUE";
  }

  if (temperature_valide) temp = round(temp * 100.0) / 100.0;
  ph = round(ph * 100.0) / 100.0;
  tds = round(tds * 100.0) / 100.0;

  // ==========================================
  // INFERENCE TINYML (EDGE IMPULSE K-MEANS)
  // ==========================================
  
  // 1. Enregistrement dans le buffer
  hist_ph[index_ml] = ph;
  hist_tds[index_ml] = tds;
  hist_temp[index_ml] = temperature_valide ? temp : 25.0; 
  
  index_ml = (index_ml + 1) % FENETRE_TINYML;
  if (index_ml == 0) buffer_ml_pret = true; 

  // --- SÉCURITÉ RÉINITIALISATION PHYSIQUE (RESET ANTI-REBOND) ---
  if (buffer_ml_pret && temp >= SEUIL_TEMP_MIN && temp <= SEUIL_TEMP_MAX && 
      ph >= SEUIL_PH_MIN && ph <= SEUIL_PH_MAX && tds <= SEUIL_TDS_MAX) {
      if (score_anomalie > 0.5) { 
        for(int i = 0; i < FENETRE_TINYML; i++) {
          hist_ph[i] = ph;
          hist_tds[i] = tds;
          hist_temp[i] = temp;
        }
        score_anomalie = 0.0; // Distance nulle pour K-Means
        logEvent("IA_RESET", "Eau pure : Buffer IA réinitialisé.");
      }
  }

  // 2. Exécution si Période de grâce passée (> 2 minutes)
  if (buffer_ml_pret && millis() > 120000) {
    
    float features[EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE];
    int f_idx = 0;
    
    // Reconstruction chronologique entrelacée attendue par Edge Impulse
    for (int i = 0; i < FENETRE_TINYML; i++) {
      int idx = (index_ml + i) % FENETRE_TINYML;
      features[f_idx++] = hist_ph[idx];
      features[f_idx++] = hist_tds[idx];
      features[f_idx++] = hist_temp[idx];
    }
    
    signal_t signal;
    numpy::signal_from_buffer(features, EI_CLASSIFIER_DSP_INPUT_FRAME_SIZE, &signal);
    
    ei_impulse_result_t result = { 0 };
    EI_IMPULSE_ERROR err = run_classifier(&signal, &result, false);
    
    if (err == EI_IMPULSE_OK) {
      score_anomalie = result.anomaly;
      
      if (score_anomalie > 0.5) {
        urgence_buzzer = true;
        if (index_alerte < 10) alertes[index_alerte++] = "IA_DERIVE_DETECTEE";
        logEvent("TINYML_ALERT", "Anomalie IA détectée !");
      }
    }
  } else {
    score_anomalie = 0.0; 
  }

  // --- LOGIQUE DES MODES ET DES RELAIS ---
  if (kill_switch_active) {
    appliquerArretUrgence();
    urgence_buzzer = true;
    if (index_alerte < 10) alertes[index_alerte++] = "KILL_SWITCH_ACTIF";
  } else {
    if (mode_auto) {
      if (temperature_valide) {
        if (temp < SEUIL_TEMP_MIN) digitalWrite(PIN_REL_CHAUFFE, HIGH);
        else if (temp > SEUIL_TEMP_MAX) digitalWrite(PIN_REL_CHAUFFE, LOW);
      } else {
        digitalWrite(PIN_REL_CHAUFFE, LOW);
      }

      bool besoin_filtration = (tds > SEUIL_TDS_MAX || ph < SEUIL_PH_MIN || ph > SEUIL_PH_MAX);
      digitalWrite(PIN_REL_FILTRE, besoin_filtration ? HIGH : LOW);
      digitalWrite(PIN_REL_OXYGENE, HIGH); 
      ledcWrite(PIN_ECLAIRAGE, intensite_led);

    } else {
      digitalWrite(PIN_REL_CHAUFFE, (temperature_valide && manual_actuators.chauffage) ? HIGH : LOW);
      digitalWrite(PIN_REL_FILTRE, manual_actuators.filtration ? HIGH : LOW);
      digitalWrite(PIN_REL_OXYGENE, manual_actuators.oxygene ? HIGH : LOW);
      ledcWrite(PIN_ECLAIRAGE, manual_actuators.eclairage_pwm);
      if (manual_actuators.buzzer) urgence_buzzer = true;
    }
  }

  alarme_critique = urgence_buzzer;

  // --- PACKAGING JSON CORRECT ---
  StaticJsonDocument<1024> doc;
  doc["device_id"] = DEVICE_ID; 

  JsonObject sensors = doc.createNestedObject("sensors");
  
  // Gestion propre du nullptr en cas de déconnexion du DS18B20
  if (!temperature_valide) {
    sensors["temp"] = nullptr; 
  } else {
    sensors["temp"] = temp;
  }
  
  sensors["ph"] = ph;
  sensors["tds"] = tds;
  sensors["lux"] = lux;
  sensors["remplissage_pct"] = pourcentage_eau;
  sensors["flotteur"] = etat_flotteur; 
  sensors["anomaly_score"] = score_anomalie; 

  JsonObject actuators = doc.createNestedObject("actuators");
  actuators["chauffage"] = (digitalRead(PIN_REL_CHAUFFE) == HIGH);
  actuators["filtration"] = (digitalRead(PIN_REL_FILTRE) == HIGH);
  actuators["oxygene"] = (digitalRead(PIN_REL_OXYGENE) == HIGH);
  actuators["buzzer"] = alarme_critique;
  actuators["feeder"] = nourrissage_actif || (temps_repas == 1);
  actuators["eclairage_pwm"] = kill_switch_active ? 0 : (mode_auto ? intensite_led : manual_actuators.eclairage_pwm);
  actuators["mode"] = mode_auto ? "AUTO" : "MANUAL";
  actuators["temps_repas"] = temps_repas; 
  actuators["kill_switch"] = kill_switch_active;

  JsonArray alertes_array = doc.createNestedArray("alertes");
  for (int i = 0; i < index_alerte; i++) {
    alertes_array.add(alertes[i]);
  }

  char buffer[1024];
  serializeJson(doc, buffer);

  if (client.connected()) {
    client.publish(telemetry_topic.c_str(), buffer); 
  }
  Serial.println(buffer); 
}

void setup() {
  Serial.begin(115200);
  delay(500);

  analogReadResolution(12);

  distributeur.setPeriodHertz(50); 
  distributeur.attach(PIN_SERVO, 500, 2400); 
  distributeur.write(0); 

  pinMode(PIN_FLOTTEUR_HAUT, INPUT_PULLUP);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);

  pinMode(PIN_REL_OXYGENE, OUTPUT);
  pinMode(PIN_REL_FILTRE, OUTPUT);
  pinMode(PIN_REL_CHAUFFE, OUTPUT);

  // Initialisation de l'alimentation matérielle du TDS uniquement
  pinMode(PIN_ALIM_TDS, OUTPUT);
  digitalWrite(PIN_ALIM_TDS, LOW); 

  ledcAttach(PIN_REL_BUZZER, 2000, 8);
  ledcWrite(PIN_REL_BUZZER, 0); 

  ledcAttach(PIN_ECLAIRAGE, 5000, 8);
  ledcWrite(PIN_ECLAIRAGE, 0);

  digitalWrite(PIN_REL_OXYGENE, LOW);  
  digitalWrite(PIN_REL_FILTRE, LOW);   
  digitalWrite(PIN_REL_CHAUFFE, LOW);  

  ds18b20.begin();

  // Le controle local demarre immediatement, meme sans reseau.
  demarrerConnexionWiFi(false);

  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  client.setServer(mqtt_server, 1883);
  client.setCallback(mqttCallback);
  client.setBufferSize(1024);
  client.setSocketTimeout(MQTT_SOCKET_TIMEOUT_SECONDS);

  // Initialisation du buffer IA
  for(int i=0; i<FENETRE_TINYML; i++) {
    hist_ph[i] = 7.4;
    hist_tds[i] = 100.0;
    hist_temp[i] = 25.0;
  }

  mode_auto = true;
}

void loop() {
  unsigned long now = millis();

  handleWiFi();
  handleMQTT();

  if (now - lastMsg > INTERVALLE_ENVOI) {
    lastMsg = now;
    readSensorsAndRegulate();
  }

  static bool buzzer_actuellement_on = false;
  if (alarme_critique) {
    if ((millis() / 500) % 2 == 0) {
      if (!buzzer_actuellement_on) {
        ledcWriteTone(PIN_REL_BUZZER, 2000);
        buzzer_actuellement_on = true;
      }
    } else {
      if (buzzer_actuellement_on) {
        ledcWrite(PIN_REL_BUZZER, 0); 
        buzzer_actuellement_on = false;
      }
    }
  } else {
    if (buzzer_actuellement_on) {
      ledcWrite(PIN_REL_BUZZER, 0); 
      buzzer_actuellement_on = false;
    }
  }
}

