/*
 * BARE MINIMUM - SLAVE 2 ESP32 MODULE TEST
 * Only Bluetooth - NO LEDs, NO sensors, NO libraries
 * Just test if the ESP32 module can advertise and be found
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool connected = false;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    connected = true;
    Serial.println("✅ CONNECTED!");
  }

  void onDisconnect(BLEServer* pServer) {
    connected = false;
    Serial.println("❌ Disconnected");
    BLEDevice::startAdvertising();
  }
};

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("╔════════════════════════════════╗");
  Serial.println("║  SLAVE 2 - BARE ESP32 TEST    ║");
  Serial.println("║  Only BLE - Nothing else       ║");
  Serial.println("╚════════════════════════════════╝");
  
  // Initialize BLE
  BLEDevice::init("NeoXalle_Slave_2");
  
  Serial.print("📍 Address: ");
  Serial.println(BLEDevice::getAddress().toString().c_str());
  
  // Create server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());
  
  // Create service
  BLEService* pService = pServer->createService(SERVICE_UUID);
  
  // Create characteristic
  pCharacteristic = pService->createCharacteristic(
    CHAR_UUID,
    BLECharacteristic::PROPERTY_READ |
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_NOTIFY
  );
  
  pCharacteristic->addDescriptor(new BLE2902());
  
  // Start service
  pService->start();
  
  // Start advertising - simple method
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  
  BLEAdvertisementData scanResponseData;
  scanResponseData.setName("NeoXalle_Slave_2");
  pAdvertising->setScanResponseData(scanResponseData);
  
  BLEDevice::startAdvertising();
  
  Serial.println("╔════════════════════════════════╗");
  Serial.println("║  ✅ ADVERTISING                ║");
  Serial.println("║  🔍 Name: NeoXalle_Slave_2     ║");
  Serial.println("║  📡 Waiting...                 ║");
  Serial.println("╚════════════════════════════════╝");
}

void loop() {
  if (connected) {
    static unsigned long lastMsg = 0;
    if (millis() - lastMsg > 3000) {
      Serial.println("💓 Connected - " + String(millis()/1000) + "s");
      lastMsg = millis();
    }
  } else {
    static unsigned long lastMsg = 0;
    if (millis() - lastMsg > 5000) {
      Serial.println("📡 Advertising... " + String(millis()/1000) + "s");
      lastMsg = millis();
    }
  }
  
  delay(100);
}
