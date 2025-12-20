#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define DEVICE_NAME "NEOXALLE"
#define SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define CHAR_UUID "6e400002-b5a3-f393-e0a9-e50e24dcca9e"

BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;

/* ===== SERVER CALLBACKS ===== */
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("📱 App conectada!");
    // Request MTU size for better data transfer
    pServer->updatePeerMTU(pServer->getConnId(), 512);
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("📱 App desconectada");
  }
};

/* ===== CHARACTERISTIC CALLBACKS ===== */
class CharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    if (pCharacteristic->getValue().length() > 0) {
      Serial.print("📩 App -> Master: ");
      Serial.println(pCharacteristic->getValue().c_str());
      
      // TODO: Aquí procesarás comandos y los enviarás a los slaves
    }
  }
};

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("🚀 NeoXalle BLE MASTER");
  Serial.println("Esperando conexión de la app...");
  
  // Inicializar BLE
  BLEDevice::init(DEVICE_NAME);
  
  // Crear servidor BLE
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  
  // Crear servicio
  BLEService* pService = pServer->createService(SERVICE_UUID);
  
  // Crear característica (READ, WRITE, NOTIFY)
  pCharacteristic = pService->createCharacteristic(
    CHAR_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  
  pCharacteristic->setCallbacks(new CharacteristicCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());
  
  // Iniciar servicio
  pService->start();
  
  // Iniciar advertising con configuración mejorada
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // Intervalo mínimo de conexión
  pAdvertising->setMaxPreferred(0x12);  // Intervalo máximo de conexión
  
  BLEDevice::startAdvertising();
  
  Serial.println("✅ BLE Server activo - Dispositivo visible como 'NEOXALLE'");
  Serial.println("📡 Esperando que la app se conecte...");
}

void loop() {
  // Manejar desconexión y reconexión
  if (!deviceConnected && oldDeviceConnected) {
    Serial.println("⚠️ Desconexión detectada, limpiando y reactivando...");
    delay(500); // Dar tiempo para limpiar
    oldDeviceConnected = false;
    BLEDevice::startAdvertising();
    Serial.println("🔄 Advertising reactivado - Listo para nueva conexión");
  }
  
  // Detectar nueva conexión
  if (deviceConnected && !oldDeviceConnected) {
    Serial.println("✅ Nueva conexión establecida con la app");
    oldDeviceConnected = true;
  }
  
  // Enviar heartbeat a la app cada 3 segundos si está conectada
  if (deviceConnected) {
    static unsigned long lastSend = 0;
    if (millis() - lastSend > 3000) {
      String msg = "Hello from NeoXalle Master";
      pCharacteristic->setValue(msg.c_str());
      pCharacteristic->notify();
      Serial.println("📤 Master -> App: " + msg);
      lastSend = millis();
    }
  }
  
  delay(50);
}
